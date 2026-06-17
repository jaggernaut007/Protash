/**
 * Multi-Agent Orchestrator
 * Coordinates multiple agents to evaluate and improve generated code
 */

import { MessageBus, AgentResponse } from './messageBus';
import { allAgents, Agent } from './agents';
import { generateText } from 'ai';
import { deepseek, ORCHESTRATOR_MODEL } from './aiConfig';

export interface OrchestrationResult {
  approved: boolean;
  generatedCode: string;
  agentResponses: AgentResponse[];
  summary: string;
  iterations: number;
}

export class MultiAgentOrchestrator {
  private messageBus: MessageBus;
  private agents: Agent[];
  private maxIterations: number = 5;

  constructor(agents: Agent[] = allAgents) {
    this.messageBus = new MessageBus();
    this.agents = agents;
  }

  /**
   * Orchestrate the evaluation and improvement of generated code
   */
  async orchestrate(userQuery: string, generatedCode: string): Promise<OrchestrationResult> {
    console.log('\n🚀 Starting Multi-Agent Orchestration');
    console.log('📝 User Query:', userQuery);
    console.log('👥 Active Agents:', this.agents.map(a => a.name).join(', '));
    console.log('─'.repeat(80));

    const agentResponses: AgentResponse[] = [];
    let currentCode = generatedCode;
    let totalIterations = 0;
    let allApproved = false;

    // Iterate through each agent sequentially
    for (const agent of this.agents) {
      console.log(`\n🔍 ${agent.name} (${agent.role}) - Starting evaluation...`);
      let agentApproved = false;
      let attempts = 0;

      // Try up to maxIterations times to get approval from this agent
      while (!agentApproved && attempts < this.maxIterations) {
        attempts++;
        totalIterations++;

        // Evaluate with the agent
        const response = await this.evaluateWithAgent(
          agent,
          userQuery,
          currentCode
        );
        agentResponses.push(response);

        if (response.approved) {
          console.log(`   ✅ ${agent.name} APPROVED (attempt ${attempts}/${this.maxIterations})`);
          console.log(`   📋 Feedback: ${response.feedback}`);
          // If UI/UX approved but provided suggestions, force one polish iteration
          if (agent.name === 'UI/UX Agent' && attempts === 1 && response.suggestions && response.suggestions.length > 0) {
            console.log('   ✨ UI/UX polish requested based on suggestions, applying one enhancement iteration...');
            currentCode = await this.requestCodeFix(
              userQuery,
              currentCode,
              response
            );
            console.log('   💎 Enhancement applied. Re-evaluating UI/UX...');
            // Do not mark approved yet; trigger another evaluation
            agentApproved = false;
          } else {
            agentApproved = true;
          }
        } else {
          console.log(`   ❌ ${agent.name} REJECTED (attempt ${attempts}/${this.maxIterations})`);
          console.log(`   📋 Feedback: ${response.feedback}`);
          if (response.suggestions && response.suggestions.length > 0) {
            console.log(`   💡 Suggestions:`);
            response.suggestions.forEach(s => console.log(`      • ${s}`));
          }
          
          // Agent rejected, request code fix
          if (attempts < this.maxIterations) {
            console.log(`   🔧 Requesting code fix...`);
            currentCode = await this.requestCodeFix(
              userQuery,
              currentCode,
              response
            );
            console.log(`   ✨ Code fixed! Retrying evaluation...`);
          }
        }
      }

      // If agent still hasn't approved after maxIterations, stop orchestration
      if (!agentApproved) {
        console.log(`   🚫 Max attempts reached for ${agent.name} - Stopping orchestration`);
        const summary = this.generateSummary(agentResponses, false);
        console.log('\n' + '═'.repeat(80));
        console.log('⛔ REJECTED:', summary);
        console.log('═'.repeat(80) + '\n');
        return {
          approved: false,
          generatedCode: currentCode,
          agentResponses,
          summary,
          iterations: totalIterations,
        };
      }
    }

    // All agents approved
    allApproved = true;
    const summary = this.generateSummary(agentResponses, allApproved);
    
    console.log('\n' + '═'.repeat(80));
    console.log('🎉 SUCCESS:', summary);
    console.log('═'.repeat(80) + '\n');

    return {
      approved: allApproved,
      generatedCode: currentCode,
      agentResponses,
      summary,
      iterations: totalIterations,
    };
  }

  /**
   * Request code fix from OpenAI based on agent feedback
   */
  private async requestCodeFix(
    userQuery: string,
    currentCode: string,
    agentResponse: AgentResponse
  ): Promise<string> {
    const fixPrompt = `You are a code improvement assistant. Fix the following code based on the agent's feedback.

User Request: "${userQuery}"

Current Code:
${currentCode}

Agent: ${agentResponse.agentName}
Feedback: ${agentResponse.feedback}
Suggestions: ${agentResponse.suggestions?.join(', ') || 'None'}

Please provide the improved code. Return ONLY the fixed code without any explanation or markdown formatting.`;

    const { text } = await generateText({
      model: deepseek(ORCHESTRATOR_MODEL),
      prompt: fixPrompt,
    });

    // Publish fix request to message bus
    this.messageBus.publish({
      from: 'Orchestrator',
      to: agentResponse.agentName,
      type: 'request',
      content: `Code fix requested based on feedback`,
      metadata: { originalCode: currentCode, fixedCode: text },
    });

    // Strip markdown code fences if the LLM wraps the output despite instructions
    const fenceMatch = text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
    return fenceMatch ? fenceMatch[1].trim() : text.trim();
  }

  /**
   * Evaluate code with a specific agent
   */
  private async evaluateWithAgent(
    agent: Agent,
    userQuery: string,
    code: string
  ): Promise<AgentResponse> {
    const response = await agent.evaluate(userQuery, code);

    // Publish evaluation result to message bus
    this.messageBus.publish({
      from: agent.name,
      to: 'Orchestrator',
      type: response.approved ? 'approval' : 'rejection',
      content: response.feedback,
      metadata: { response },
    });

    return response;
  }

  /**
   * Generate a summary of the orchestration process
   */
  private generateSummary(
    agentResponses: AgentResponse[],
    approved: boolean
  ): string {
    if (approved) {
      // Derive a lightweight style score from UI/UX response
      const uiux = agentResponses.filter(r => r.agentName === 'UI/UX Agent').pop();
      let styleScore = 3;
      if (uiux?.approved) styleScore += 1;
      if (!uiux || (uiux.suggestions && uiux.suggestions.length === 0)) styleScore += 1;
      if (styleScore < 1) styleScore = 1; if (styleScore > 5) styleScore = 5;
      return `All agents approved the code. Total evaluations: ${agentResponses.length}. Style score: ${styleScore}/5`;
    }

    const rejections = agentResponses.filter((r) => !r.approved);
    const lastRejection = rejections[rejections.length - 1];
    if (!lastRejection) {
      return `Code rejected after max iterations. Total evaluations: ${agentResponses.length}`;
    }

    return `Code rejected by ${lastRejection.agentName}. Reason: ${lastRejection.feedback}`;
  }

  /**
   * Get the message history from the message bus
   */
  getMessageHistory() {
    return this.messageBus.getMessages();
  }

  /**
   * Clear the message history
   */
  clearHistory() {
    this.messageBus.clear();
  }
}
