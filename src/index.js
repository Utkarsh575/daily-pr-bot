import TelegramBot from "node-telegram-bot-api";
import moment from "moment-timezone";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

const PR_BOT_TOKEN = process.env.PR_BOT_TOKEN;
// const GROUP_ID = -1002472603673;
// const TOPIC_ID = 193;
const GROUP_ID = -1002162367846;
const TOPIC_ID = 5235;
const TIMEZONE = "Asia/Kolkata";
const bot = new TelegramBot(PR_BOT_TOKEN, { polling: true });

const users = new Set();
const exemptUsers = new Set();
let dailyMessages = [];

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const topicId = msg.message_thread_id;

  const helpMessage = ` 
Available Commands:
- /test: Check if the bot is running smoothly.
- /exempt @username: Exempt a user from daily updates.
- /add @username: Manually add a user to the daily updates list.
- /removeexempt @username: Remove a user from the exemption list.
- /list: List all users and exempted users.
- /update: Submit your GitHub pull request link.
- /help: Show this help message.
  `;
  if (chatId === GROUP_ID && topicId === TOPIC_ID) {
    bot.sendMessage(GROUP_ID, helpMessage, { message_thread_id: TOPIC_ID });
  }
});

bot.onText(/(@daily-update-bot|\/update)([\s\S]+)/, (msg) => {
  const chatId = msg.chat.id;
  const topicId = msg.message_thread_id;

  const prRegex = /https:\/\/github\.com\/.*\/pull\/\d+/; // Regex to check for GitHub PR link

  if (
    chatId === GROUP_ID &&
    topicId === TOPIC_ID &&
    !exemptUsers.has(msg.from.username)
  ) {
    const messageContent = msg.text;

    if (!prRegex.test(messageContent)) {
      bot.sendMessage(
        chatId,
        `@${msg.from.username}, your message should contain a valid GitHub pull request link.`,
        {
          message_thread_id: topicId,
        }
      );
      return;
    }

    const username = msg.from.username;
    users.add(username);
    dailyMessages.push(username);
    console.log(`User added: ${username}`);

    bot.sendMessage(
      chatId,
      `@${msg.from.username}, your pull request has been recorded.`,
      {
        message_thread_id: topicId,
      }
    );
  }
});

bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  const topicId = msg.message_thread_id;

  if (chatId === GROUP_ID && topicId === TOPIC_ID) {
    const userList =
      Array.from(users)
        .map((user) => `@${user}`)
        .join("\n") || "No users added.";
    const exemptList =
      Array.from(exemptUsers)
        .map((user) => `@${user}`)
        .join("\n") || "No exempted users.";

    const listMessage = `
  *Employees:*
  ${userList}
  
  *Exempted from daily updates:*
  ${exemptList}
      `;
    bot.sendMessage(GROUP_ID, listMessage, {
      message_thread_id: TOPIC_ID,
      parse_mode: "Markdown",
    });
  }
});
cron.schedule(
  "0 0 * * *",
  () => {
    console.log(
      `-------------Checking updates at: ${moment()
        .tz(TIMEZONE)
        .format()}-------------`
    );
    console.log("dailyMessages", dailyMessages);
    console.log("users", users);
    console.log("exemptUsers", exemptUsers);

    checkForMissingPRs();
  },
  { timezone: TIMEZONE }
);

const checkForMissingPRs = async () => {
  if (users.size === 0) {
    return;
  }
  let missingPRs = [];

  for (const user of users) {
    if (!exemptUsers.has(user) && !dailyMessages.some((msg) => msg === user)) {
      missingPRs.push(user);
    }
  }
  console.log("missingPRs", missingPRs);

  dailyMessages = []; //flush daily messages

  const reminderMessage =
    missingPRs.length > 0
      ? `Reminder: The following users haven't submitted their pull request:\n${missingPRs
          .map((userId) => `@${userId}`)
          .join("\n")}`
      : "All users have submitted their pull requests today!";

  bot.sendMessage(GROUP_ID, reminderMessage, { message_thread_id: TOPIC_ID });
};

bot.onText(/\/exempt (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const topicId = msg.message_thread_id;

  if (chatId === GROUP_ID && topicId === TOPIC_ID) {
    const userToExempt = match[1].replace("@", "").trim();
    exemptUsers.add(userToExempt);
    bot.sendMessage(
      GROUP_ID,
      `@${userToExempt} has been exempted from daily updates.`,
      {
        message_thread_id: TOPIC_ID,
      }
    );
  }
});

bot.onText(/\/add (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const topicId = msg.message_thread_id;

  if (chatId === GROUP_ID && topicId === TOPIC_ID) {
    const userToAdd = match[1].replace("@", "").trim();
    users.add(userToAdd);
    bot.sendMessage(GROUP_ID, `@${userToAdd} has been added to the list.`, {
      message_thread_id: TOPIC_ID,
    });
  }
});

bot.onText(/\/removeexempt (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const topicId = msg.message_thread_id;

  if (chatId === GROUP_ID && topicId === TOPIC_ID) {
    const userToRemove = match[1].replace("@", "").trim();
    exemptUsers.delete(userToRemove);
    bot.sendMessage(
      GROUP_ID,
      `@${userToRemove} has been removed from the exemption list.`,
      { message_thread_id: TOPIC_ID }
    );
  }
});
bot.onText(/\/test/, (msg) => {
  const chatId = msg.chat.id;
  const topicId = msg.message_thread_id;

  if (chatId === GROUP_ID && topicId === TOPIC_ID) {
    bot.sendMessage(GROUP_ID, "Health check: Bot is running smoothly!", {
      message_thread_id: TOPIC_ID,
    });
  }
});

console.log("PR Bot is running...");
