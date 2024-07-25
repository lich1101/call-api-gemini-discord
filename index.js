require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, Partials } = require('discord.js');
const { runGeminiflash, runGeminiVision } = require('./gemini');
const fs = require("fs");
const path = require('path');
const https = require('https');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

client.login(process.env.DISCORD_TOKEN);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!ex')) return; // Chỉ xử lý nếu tin nhắn bắt đầu bằng !ex

    const prompt = message.content.slice(3).trim(); // Loại bỏ !ex khỏi nội dung tin nhắn
    const isDM = message.channel.type === ChannelType.DM;
    const isGuildText = message.channel.type === ChannelType.GuildText;
    if (isDM || isGuildText) {
        try {
            let localPath = null;
            let mimeType = null;

            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                const url = attachment.url;
                mimeType = attachment.contentType;
                const filename = attachment.name;
                localPath = path.join(__dirname, 'image', filename);

                const file = fs.createWriteStream(localPath);
                https.get(url, (response) => {
                    response.pipe(file);
                    file.on('finish', async () => {
                        file.close(async () => {
                            try {
                                const userName = message.author.username;
                                const response = await runGeminiVision(prompt, localPath, mimeType);
                                const results = splitResponse(response);
                                results.forEach(result => message.reply(result));
                                fs.unlink(localPath, (err) => {
                                    if (err) {
                                        console.error('Error deleting file:', err);
                                    } else {
                                        console.log('File successfully deleted.');
                                    }
                                });
                            } catch (error) {
                                const response = await runGeminiflash(prompt);
                                const results = splitResponse(response);
                                results.forEach(result => message.reply(result));
                            }
                        });
                    });
                });
            } else {
                const response = await runGeminiflash(prompt);
                const results = splitResponse(response);
                results.forEach(result => message.reply(result));
            }
        } catch (error) {
            console.error(error);
            message.reply('There was an error trying to execute that command!');
        }
    }
});

function splitResponse(response) {
    const maxChunkLength = 2000;
    let chunks = [];
    for (let i = 0; i < response.length; i += maxChunkLength) {
        chunks.push(response.substring(i, i + maxChunkLength));
    }
    return chunks;
}
