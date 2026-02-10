import { WebClient } from '@slack/web-api';

async function testSlack() {
  const token = process.env.SLACK_BOT_TOKEN;
  const userId = process.env.SLACK_USER_ID || 'UBMGWSSS1';

  if (!token) {
    console.error('❌ SLACK_BOT_TOKEN environment variable not set');
    process.exit(1);
  }

  console.log('🔄 Testing Slack connection...');
  console.log(`📱 Target user ID: ${userId}`);

  const client = new WebClient(token);

  try {
    // Test 1: Verify bot token works
    console.log('\n✅ Test 1: Verifying bot token...');
    const authTest = await client.auth.test();
    console.log(`   Bot name: ${authTest.user}`);
    console.log(`   Team: ${authTest.team}`);

    // Test 2: Send a test DM
    console.log('\n✅ Test 2: Sending test message...');
    const result = await client.chat.postMessage({
      channel: userId,
      text: '🧪 Test message from FR Triage Service\n\nThis is a test to verify Slack credentials are working correctly.',
    });

    console.log(`   Message sent successfully!`);
    console.log(`   Timestamp: ${result.ts}`);
    console.log(`   Channel: ${result.channel}`);

    console.log('\n✅ All tests passed! Slack integration is working correctly.');
  } catch (error: any) {
    console.error('\n❌ Slack test failed:', error.message);
    if (error.data) {
      console.error('   Error details:', JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
}

testSlack();
