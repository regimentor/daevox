class ServiceError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def bad_request(message: str) -> ServiceError:
    return ServiceError(400, "invalid_request", message)


def not_found(message: str) -> ServiceError:
    return ServiceError(404, "not_found", message)


def conflict(message: str) -> ServiceError:
    return ServiceError(409, "conflict", message)


def unavailable(message: str) -> ServiceError:
    return ServiceError(503, "unavailable", message)
