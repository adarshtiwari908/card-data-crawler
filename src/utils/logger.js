const chalk = require("chalk");

function getTimestamp() {
  return new Date().toISOString().slice(11, 19);
}

function logMessage(type, color, emoji, message) {
  const timestamp = getTimestamp();
  console.log(chalk[color](`[${timestamp}] ${emoji} ${type}: ${message}`));
}

function logInfo(message) {
  logMessage("INFO", "blue", "ℹ️", message);
}

function logSuccess(message) {
  logMessage("SUCCESS", "green", "✅", message);
}

function logError(message, error = null) {
  logMessage("ERROR", "red", "❌", message);
  if (error && error.stack) console.log(chalk.red.dim(error.stack));
}

function logWarn(message) {
  logMessage("WARN", "yellow", "⚠️", message);
}

function logDebug(message) {
  logMessage("DEBUG", "gray", "🐛", message);
}

function logSection(title) {
  const separator = "=".repeat(50);
  console.log(chalk.cyan.bold(`\n${separator}`));
  console.log(chalk.cyan.bold(`  ${title.toUpperCase()}`));
  console.log(chalk.cyan.bold(`${separator}\n`));
}

function logStart(operation) {
  console.log(chalk.magenta.bold(`\n🚀 Starting: ${operation}`));
}

function logComplete(operation, duration = null) {
  let message = `🎉 Completed: ${operation}`;
  if (duration !== null) message += ` (${duration}ms)`;
  console.log(chalk.green.bold(message));
}

function logProgress(operation, current, total) {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.floor(percentage / 5);
  const progressBar = "█".repeat(filled) + "░".repeat(20 - filled);
  const message = `${operation}: [${progressBar}] ${percentage}% (${current}/${total})`;
  process.stdout.write(chalk.blue(`\r${message}`));
  if (current === total) console.log("");
}

function logTable(title, data) {
  console.log(chalk.cyan.bold(`\n📊 ${title}:`));
  console.log(chalk.cyan("─".repeat(40)));
  for (const [key, value] of Object.entries(data)) {
    const formattedKey = chalk.white.bold(key.padEnd(20));
    const formattedValue = chalk.white(value);
    console.log(`${formattedKey}: ${formattedValue}`);
  }
  console.log(chalk.cyan("─".repeat(40)) + "\n");
}

module.exports = {
  logInfo,
  logSuccess,
  logError,
  logWarn,
  logDebug,
  logSection,
  logStart,
  logComplete,
  logProgress,
  logTable,
};
