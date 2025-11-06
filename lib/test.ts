import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'Bạn là một trợ lý thông minh, giúp trả lời câu hỏi lập trình.',
});

async function main() {
  const result = await run(agent, 'Viết một đoạn code JavaScript in ra "Hello World"');

  console.log('Kết quả cuối cùng:', result.finalOutput);
  console.log('Log chi tiết:', result.runTrace); // xem các bước agent thực hiện
}

main();
