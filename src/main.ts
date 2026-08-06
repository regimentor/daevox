import { createAgent } from "./agent/agent.js";
import agentTestTaskPrompt from "./agent/prompts/agent-test-task.js";
import architectPrompt from "./agent/prompts/architect.js";
import plannerPrompt from "./agent/prompts/planner.js";
import teamLeadPrompt from "./agent/prompts/team-lead.js";

async function main() {
  const agent1 = createAgent({
    name: "Team Lead",
    systemPrompt: teamLeadPrompt(),
    userPrompt: agentTestTaskPrompt(),
  });

  const agent2 = createAgent({
    name: "Architect",
    systemPrompt: architectPrompt(),
    userPrompt: agentTestTaskPrompt(),
  });

  const [lead, architect] = await Promise.all([agent1({}), agent2({})]);

  const agent3 = createAgent({
    name: "Planner",
    systemPrompt: plannerPrompt({
      architectCompletion: architect.response,
      teamLeadCompletion: lead.response,
    }),
    userPrompt: "Создай план работы на основе предоставленных инструкций архитектора и team-lead.",
  });

  const planner = await agent3({});

  console.log("\n\nLead response:", lead.response);
  console.log("\n\nArchitect response:", architect.response);
  console.log("\n\nPlanner response:", planner.response);
}

export { main };
