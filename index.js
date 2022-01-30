const express = require('express');
const { Telegraf, Markup, session } = require('telegraf');
const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();
const animations = require('./animations.js');
const User = require('./models/User');

const app = express();

const bot = new Telegraf(process.env.LovelyHeartsBOT_TOKEN, { polling: true });
const SurpriseNotifier = new Telegraf(process.env.SurpriseNotifierBOT_TOKEN, {
    polling: true,
});

bot.use(session());
SurpriseNotifier.use(session());

function createActionAnimation(name, frames, lastMSG, delay = 350) {
    bot.action(name, async (ctx) => {
        await ctx.answerCbQuery();
        for (let i = 0; i < frames.length; i++) {
            setTimeout(async () => {
                frames[i] = frames[i].replaceAll(' ', '');
                await ctx.editMessageText(frames[i]);
                if (i === frames.length - 1) {
                    if (lastMSG) {
                        setTimeout(
                            async () =>
                                await ctx.editMessageText(
                                    lastMSG,
                                    Markup.inlineKeyboard([
                                        Markup.button.callback(
                                            '🔄 Заново 🔄',
                                            name
                                        ),
                                    ])
                                ),
                            delay * 2
                        );
                    } else {
                        await ctx.editMessageText(
                            frames[i],
                            Markup.inlineKeyboard([
                                Markup.button.callback('🔄 Заново 🔄', name),
                            ])
                        );
                    }
                }
            }, i * delay);
        }
    });
}

const callbackBtn = (text, callback) => Markup.button.callback(text, callback);

SurpriseNotifier.start(async (ctx) => {
    const user = await User.findOne({ chatId: ctx.chat.id });
    if (user) {
        await ctx.reply('Уже запущено! ☑️');
        return;
    }
    const newUser = new User({
        human_name: ctx.message.chat.first_name,
        username: ctx.message.chat.username,
        chatId: ctx.message.chat.id,
    });
    newUser
        .save()
        .then(async () => await ctx.reply('✅ Запущено. Ожидаю уведомления...'))
        .catch((err) =>
            console.log('an error occured in ' + ctx.message.chat.id, err)
        );
});

bot.start(async (ctx) => {
    await ctx.reply(
        `
        <b>Привет, Незнакомец! ♥️</b>
        Этот бот поможет тебе сделать приятный сюрприз твоему другу или просто близкому человеку.
        Чтобы узнать, как это сделать, держи команду: /how <i>(нажми)</i>
        `.replaceAll('  ', ''),
        {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    ['Обычная'],
                    ['Отправить анимацию другому'],
                    ['Поддержать разработчика!'],
                ],
                resize_keyboard: true,
                one_time_keyboard: true,
            },
        }
    );
});

bot.command('how', async (ctx) => {
    await ctx.reply(
        `
        <b>Как это сделать?</b>
        Для того, чтобы сделать приятный сюрприз, нашего друга необходимо подписать на бота, который будет присылать ему эти сюрпризы.

        <i><b>Не волнуйся, твой друг не узнает, что ты хочешь сделать.</b></i>

        Необходимо, чтобы он или она запустила следующего бота: @SurpriseNotifierBot.

        Далее, чтобы отправить анимацию, тебе необходимо нажать на кнопку "Отправить анимацию другому", после чего вписать никнейм пользователя в телеграме (например: @ppitohu).
        Выбрать соответствующую анимацию и отправить её!

        Ты в любой момент сможешь отправлять другу красивые анимации <b>(без предупреждения!)</b>.

        ❤️ Бот актуален для влюбленных ❤️
        `.replaceAll('  ', ''),
        { parse_mode: 'HTML' }
    );
});

bot.hears('Поддержать разработчика!', async (ctx) => {
    await ctx.reply(
        `
        <b>Поддержать разработчика можно отправив ему пару шейкелей на <a href="https://www.donationalerts.com/r/ppitohu">DonationAlerts</a></b>
        `.replaceAll('  ', ''),
        {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        }
    );
});

bot.hears('Отправить анимацию другому', async (ctx) => {
    await ctx.reply('Отправь мне его имя пользователя (пример: @ppitohu)');
});

animations.forEach((animation) => {
    createActionAnimation(animation.human_name, animation.frames);
    bot.hears(animation.human_name, async (ctx) => {
        try {
            await ctx.reply(
                `Выбрана анимация: ${animation.human_name}`,
                Markup.inlineKeyboard([
                    Markup.button.callback('Запустить', animation.human_name),
                ])
            );
        } catch (e) {
            console.log(e);
        }
    });
    bot.action(animation.name, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            ctx.session.sendAnimation.human_name = animation.human_name;
            ctx.session.sendAnimation.name = animation.name;
            await ctx.editMessageText(
                `
                📬 Данные доставки:
                
                🕺 Получатель: ${ctx.session.sendAnimation.username}
                🦄 Анимация: ${ctx.session.sendAnimation.human_name}
            `.replaceAll('  ', ''),
                Markup.inlineKeyboard([
                    callbackBtn('Отправить', 'sendAnimation'),
                ])
            );
        } catch (e) {
            console.log(e);
        }
    });
});

// отправка анимации -->
bot.on('text', async (ctx) => {
    if (!ctx.message.text.includes('@')) return;
    ctx.session = {
        sendAnimation: {
            name: '',
            human_name: '',
            chatId: '',
            username: '',
        },
    };
    const user = ctx.message.text.trim().replace('@', '');
    const userData = await User.findOne({ username: user });
    if (!userData)
        return await ctx.reply('❌ Пользователь не найден, попробуй еще раз.');
    ctx.session.sendAnimation.chatId = userData.chatId;
    ctx.session.sendAnimation.username = user;
    await ctx.reply(
        '✅Отлично, пользователь найден!\nВыбери анимацию, которую хочешь ему отправить.',
        Markup.inlineKeyboard([
            [callbackBtn(animations[0].human_name, animations[0].name)],
        ])
    );
});

bot.action('sendAnimation', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const user = await User.findOne({
            username: ctx.session.sendAnimation.username,
        });
        user.animation = {
            name: ctx.session.sendAnimation.name,
            frames: animations.find(
                (animation) => animation.name === ctx.session.sendAnimation.name
            ).frames,
            from: ctx.from.username,
        };
        user.save().then(async () => {
            try {
                await SurpriseNotifier.telegram.sendMessage(
                    ctx.session.sendAnimation.chatId,
                    `✉️ Вам новое сообщение!`,
                    Markup.inlineKeyboard([
                        Markup.button.callback(
                            '🔍Посмотреть',
                            'checkAnimation'
                        ),
                    ])
                );
                await ctx.editMessageText('Отправлено!');
            } catch (e) {
                await ctx.editMessageText('Пользователь остановил бота 😢');
            }
        });
    } catch (e) {
        console.log(e);
    }
});

SurpriseNotifier.action('checkAnimation', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const user = await User.findOne({ chatId: ctx.chat.id });
        const frames = user.animation.frames;
        for (let i = 0; i < frames.length; i++) {
            setTimeout(async () => {
                frames[i] = frames[i].replaceAll(' ', '');
                await ctx.editMessageText(frames[i]);
                if (i === frames.length - 1) {
                    setTimeout(
                        async () =>
                            await ctx.editMessageText(
                                `Отправил: @${user.animation.from}`
                            ),
                        1000
                    );
                }
            }, i * 350);
        }
    } catch (e) {
        console.log(e);
    }
});

mongoose.connect(
    process.env.DB_NAME,
    {
        useNewUrlParser: true,
    },
    () => console.log('connected to database')
);

const port = process.env.PORT || 5000;

// app.use(express.json());

// app.get('/', (req, res) => {
//     res.status(200).json({ message: 'Hello from the Bot API.' });
// });
// // TELEGRAM WEBHOOK - https://core.telegram.org/bots/api#setwebhook
// app.post(`/${process.env.LovelyHeartsBOT_TOKEN}`, (req, res) => {
//     bot.processUpdate(req.body);
//     res.status(200).json({ message: 'ok' });
// });
// app.post(`/${process.env.SurpriseNotifierBOT_TOKEN}`, (req, res) => {
//     bot.processUpdate(req.body);
//     res.status(200).json({ message: 'ok' });
// });

app.listen(port, () => {
    console.log(`\n\nServer running on port ${port}.\n\n`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// app.use(bot.webhookCallback('/callback1'));
// app.use(SurpriseNotifier.webhookCallback('/callback2'));

// const CURRENT_HOST = 'https://lovely-hearts-bot.vercel.app';

// app.get('/', async (_req, res) => {
//     const url1 = `${CURRENT_HOST}/callback1`;
//     const url2 = `${CURRENT_HOST}/callback2`;
//     const webhookUrl1 = await bot.telegram.getWebhookInfo();
//     if (!webhookUrl1) await bot.telegram.setWebhook(url1);
//     const webhookUrl2 = await SurpriseNotifier.telegram.getWebhookInfo();
//     if (!webhookUrl2) await SurpriseNotifier.telegram.setWebhook(url2);
//     res.send(`listening on ${CURRENT_HOST}`);
// });

// app.listen(1234, () => {
//     console.log(`listening on 1234`);
// });
