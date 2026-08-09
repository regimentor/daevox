import pytest

from websearch.cache.memory import MemoryTTLCache
from websearch.config import Settings
from websearch.models.errors import ServiceError
from websearch.models.search import SearchRequest
from websearch.services.search_service import DDGSSearchProvider, SearchService


async def test_search_service_caches_normalized_results(monkeypatch) -> None:
    settings = Settings()
    monkeypatch.setattr(
        "websearch.services.search_service._run_ddgs",
        lambda request, timeout: [
            {"title": "A", "href": "https://Example.com/docs/", "body": "a"},
            {"title": "A duplicate", "href": "https://example.com/docs?utm_source=x", "body": "b"},
            {"title": "B", "href": "https://example.com/docs?page=2", "body": "c"},
        ],
    )
    service = SearchService(DDGSSearchProvider(settings), settings, MemoryTTLCache(10))
    request = SearchRequest(query="docs")
    response = await service.search(request)
    assert [result.url for result in response.results] == [
        "https://Example.com/docs/",
        "https://example.com/docs?page=2",
    ]
    assert response.meta.count == 2
    cached = await service.search(request)
    assert cached == response


async def test_search_timeout_is_mapped(monkeypatch) -> None:
    settings = Settings(search_timeout=0.01)

    def slow_search(request, timeout):
        raise TimeoutError

    monkeypatch.setattr("websearch.services.search_service._run_ddgs", slow_search)
    with pytest.raises(ServiceError) as error:
        await DDGSSearchProvider(settings).search(SearchRequest(query="timeout"))
    assert error.value.code == "search_timeout"
