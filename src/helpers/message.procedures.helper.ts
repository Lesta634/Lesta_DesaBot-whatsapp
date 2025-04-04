import { WASocket } from "baileys";
import { Bot } from "../interfaces/bot.interface.js";
import { Group } from "../interfaces/group.interface.js";
import { Message } from "../interfaces/message.interface.js";
import { UserController } from "../controllers/user.controller.js";
import getBotTexts from "../utils/bot.texts.util.js";
import { GroupController } from "../controllers/group.controller.js";
import { buildText } from "../utils/general.util.js";
import { BotController } from "../controllers/bot.controller.js";
import { waLib } from "../libraries/library.js";

const userController = new UserController()
const botController = new BotController()
const groupController = new GroupController()

export async function isUserBlocked(client: WASocket, message: Message){
    const blockedContacts = await waLib.getBlockedContacts(client)
    return blockedContacts.includes(message.sender)
}

export async function isOwnerRegister(client: WASocket, botInfo: Bot, message: Message){
    const admins = await userController.getAdmins()
    const botTexts = getBotTexts(botInfo)

    if (!admins.length && message.command == `${botInfo.prefix}admin`){
        await userController.registerOwner(message.sender)
        await waLib.replyText(client, message.chat_id, botTexts.admin_registered, message.wa_message, {expiration: message.expiration})
        return true
    }
    
    return false
}

export async function incrementParticipantActivity(message: Message, isCommand: boolean){
    await groupController.incrementParticipantActivity(message.chat_id, message.sender, message.type, isCommand)
}

export async function incrementUserCommandsCount(message: Message){
    await userController.increaseUserCommandsCount(message.sender)
}

export function incrementBotCommandsCount(){
    botController.incrementExecutedCommands()
}

export async function incrementGroupCommandsCount(group: Group){
    await groupController.incrementGroupCommands(group.id)
}

export function isIgnoredByPvAllowed(botInfo: Bot, message: Message){
    return (!message.isBotAdmin && !botInfo.commands_pv)
}

export function isIgnoredByGroupMuted(group: Group, message: Message){
    return (group.muted && !message.isGroupAdmin)
}

export function isIgnoredByAdminMode(bot: Bot, message: Message){
    return (bot.admin_mode && !message.isBotAdmin)
}

export async function isBotLimitedByGroupRestricted(group: Group, botInfo: Bot){
    const isBotGroupAdmin = await groupController.isAdmin(group.id, botInfo.host_number)
    return (group.restricted && !isBotGroupAdmin)
}

export async function sendPrivateWelcome(client: WASocket, botInfo: Bot, message: Message){
    const botTexts = getBotTexts(botInfo)
    const user = await userController.getUser(message.sender)

    if (user && !user.receivedWelcome){
        const replyText = buildText(botTexts.new_user, botInfo.name, message.pushname)
        await waLib.sendText(client, message.chat_id, replyText, {expiration: message.expiration})
        await userController.setReceivedWelcome(user.id, true)
    }
}

export async function readUserMessage(client: WASocket, message: Message){
    await waLib.readMessage(client, message.chat_id, message.sender, message.message_id)
}

export async function updateUserName(message: Message){
    if (message.pushname) {
        await userController.setName(message.sender, message.pushname)
    }
}

export async function isUserLimitedByCommandRate(client: WASocket, botInfo: Bot, message: Message){
    if (botInfo.command_rate.status){
        const isLimited = await botController.hasExceededCommandRate(botInfo, message.sender, message.isBotAdmin)
        if (isLimited){
            const botTexts = getBotTexts(botInfo)
            const replyText = buildText(botTexts.command_rate_limited_message, botInfo.command_rate.block_time)
            await waLib.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
            return true
        }
    }
    return false
}

export async function isCommandBlockedGlobally(client: WASocket, botInfo: Bot, message: Message ){
    const commandBlocked = botController.isCommandBlockedGlobally(message.command)
    const botTexts = getBotTexts(botInfo)

    if (commandBlocked && !message.isBotAdmin){
        const replyText = buildText(botTexts.globally_blocked_command, message.command)
        await waLib.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
        return true
    }

    return false
}

export async function isCommandBlockedGroup(client: WASocket, group: Group, botInfo: Bot, message: Message){
    const commandBlocked = groupController.isBlockedCommand(group, message.command, botInfo)
    const botTexts = getBotTexts(botInfo)

    if (commandBlocked && !message.isGroupAdmin){
        const replyText = buildText(botTexts.group_blocked_command, message.command)
        await waLib.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
        return true
    }

    return false
}

export async function isDetectedByAntiLink(client: WASocket, botInfo: Bot, group: Group, message: Message){
    const botTexts = getBotTexts(botInfo)
    const isDetectedByAntilink = await groupController.isMessageWithLink(message, group, botInfo)

    if (isDetectedByAntilink){
        const replyText = buildText(botTexts.detected_link, waLib.removeWhatsappSuffix(message.sender))
        await waLib.sendTextWithMentions(client, message.chat_id, replyText, [message.sender], {expiration: message.expiration})
        await waLib.deleteMessage(client, message.wa_message, false)
        return true
    }
    
    return false
}

export async function isDetectedByAntiFlood(client: WASocket, botInfo: Bot, group: Group, message: Message){
    const botTexts = getBotTexts(botInfo)
    const isDetectedByAntiFlood = await groupController.isFlood(group, message.sender, message.isGroupAdmin)

    if (isDetectedByAntiFlood){
        const replyText = buildText(botTexts.antiflood_ban_messages, waLib.removeWhatsappSuffix(message.sender), botInfo.name)
        await waLib.removeParticipant(client, message.chat_id, message.sender)
        await waLib.sendTextWithMentions(client, message.chat_id, replyText, [message.sender], {expiration: message.expiration})
        return true
    }
    
    return false
}

