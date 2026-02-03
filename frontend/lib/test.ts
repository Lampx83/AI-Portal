import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'Bạn là một trợ lý thông minh, giúp trả lời câu hỏi lập trình.',
});

async function main() {
  const result = await run(agent, 'Viết một đoạn code JavaScript in ra "Hello World"');
  return result
}

main();
