import { downloadMediaMessage, WASocket } from "baileys";
import { Bot } from "../interfaces/bot.interface.js";
import { Message } from "../interfaces/message.interface.js";
import { Group, ParticipantCounter } from "../interfaces/group.interface.js";
import * as Whatsapp from '../lib/whatsapp.js'
import { buildText, removeWhatsappSuffix, addWhatsappSuffix, messageErrorCommandUsage } from "../lib/util.js";
import getGeneralMessages from "../lib/general-messages.js";
import getCommands from "./list.commands.js";
import { UserController } from "../controllers/user.controller.js";
import { GroupController } from "../controllers/group.controller.js";

export async function grupoCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)

    let replyText = buildText(commandsData.group.grupo.msgs.reply_title, group.name, group.participants.length, group.admins.length, group.description || '---', group.commands_executed)

    if (message.isGroupAdmin) {
        replyText += commandsData.group.grupo.msgs.reply_resource_title
        //Bem-vindo
        replyText += (group.welcome.status) ? commandsData.group.grupo.msgs.reply_item_welcome_on : commandsData.group.grupo.msgs.reply_item_welcome_off
        //Mutar
        replyText += (group.muted) ? commandsData.group.grupo.msgs.reply_item_mute_on : commandsData.group.grupo.msgs.reply_item_mute_off
        //Auto-Sticker
        replyText += (group.autosticker) ? commandsData.group.grupo.msgs.reply_item_autosticker_on : commandsData.group.grupo.msgs.reply_item_autosticker_off
        //Anti-Link
        replyText += (group.antilink) ? commandsData.group.grupo.msgs.reply_item_antilink_on : commandsData.group.grupo.msgs.reply_item_antilink_off
        //Anti-Fake
        replyText += (group.antifake.status) ? buildText(commandsData.group.grupo.msgs.reply_item_antifake_on, group.antifake.allowed.toString()) : commandsData.group.grupo.msgs.reply_item_antifake_off
        //Anti-Flood
        replyText += (group.antiflood.status) ? buildText(commandsData.group.grupo.msgs.reply_item_antiflood_on, group.antiflood.max_messages, group.antiflood.interval) : commandsData.group.grupo.msgs.reply_item_antiflood_off
        //Contador
        replyText += (group.counter.status) ? buildText(commandsData.group.grupo.msgs.reply_item_counter_on, group.counter.started) : commandsData.group.grupo.msgs.reply_item_counter_off

        //Bloqueio de CMDS
        let blockedCommands = []
        for (let command of group.block_cmds){
            blockedCommands.push(botInfo.prefix+command)
        }
        replyText += (group.block_cmds.length) ? buildText(commandsData.group.grupo.msgs.reply_item_blockcmds_on, blockedCommands.toString()) : commandsData.group.grupo.msgs.reply_item_blockcmds_off
        
        //Lista Negra
        replyText += buildText(commandsData.group.grupo.msgs.reply_item_blacklist, group.blacklist.length)
    }

    await Whatsapp.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function fotogrupoCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)
    if (message.type != 'imageMessage' && message.quotedMessage?.type != 'imageMessage') throw new Error(messageErrorCommandUsage(botInfo, message))
    
    let imageBuffer : Buffer
    if (message.isQuoted && message.quotedMessage) imageBuffer = await downloadMediaMessage(message.quotedMessage?.wa_message, "buffer", {})
    else imageBuffer = await downloadMediaMessage(message.wa_message, "buffer", {})

    await Whatsapp.updateProfilePic(client, group.id, imageBuffer)
    await Whatsapp.replyText(client, group.id, commandsData.group.fotogrupo.msgs.reply, message.wa_message, {expiration: message.expiration})
}

export async function addlistaCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)
    let targetUserId : string

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)


    if (message.isQuoted && message.quotedMessage) targetUserId = message.quotedMessage?.sender
    else if (message.mentioned.length) targetUserId = message.mentioned[0]
    else if (message.args.length) targetUserId = addWhatsappSuffix(message.text_command)
    else throw new Error(messageErrorCommandUsage(botInfo, message))

    if (targetUserId == botInfo.host_number) throw new Error(commandsData.group.addlista.msgs.error_add_bot)
    else if (group.admins.includes(targetUserId)) throw new Error(commandsData.group.addlista.msgs.error_add_admin)

    const currentBlacklist = await groupController.getBlackList(group.id)

    if (currentBlacklist.includes(targetUserId)) throw new Error(commandsData.group.addlista.msgs.error_already_listed)

    await groupController.addBlackList(group.id, targetUserId)
    await Whatsapp.replyText(client, message.chat_id, commandsData.group.addlista.msgs.reply, message.wa_message, {expiration: message.expiration})
    if (group.participants.includes(targetUserId)) await Whatsapp.removeParticipant(client, group.id, targetUserId)
}

export async function rmlistaCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)
    let targetUserId : string

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)
    if (!message.args.length) throw new Error(messageErrorCommandUsage(botInfo, message))
    
    const currentBlacklist = await groupController.getBlackList(group.id)

    if(message.args.length == 1 && message.args[0].length <= 3) targetUserId = currentBlacklist[parseInt(message.text_command) - 1]
    else targetUserId = addWhatsappSuffix(message.text_command)

    if (!currentBlacklist.includes(targetUserId)) throw new Error(commandsData.group.rmlista.msgs.error_not_listed)

    await groupController.removeBlackList(group.id, targetUserId)
    await Whatsapp.replyText(client, message.chat_id, commandsData.group.rmlista.msgs.reply, message.wa_message, {expiration: message.expiration})
}

export async function listanegraCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const userController = new UserController()
    const groupController = new GroupController()
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)

    const currentBlacklist = await groupController.getBlackList(group.id)
    let replyText = buildText(commandsData.group.listanegra.msgs.reply_title, currentBlacklist.length)

    if (!currentBlacklist.length) throw new Error(commandsData.group.listanegra.msgs.error_empty_list)

    for(let userId of currentBlacklist){
        const userData = await userController.getUser(userId)
        const userNumberList = currentBlacklist.indexOf(userId) + 1
        replyText += buildText(commandsData.group.listanegra.msgs.reply_item, userNumberList, userData?.name || '---', removeWhatsappSuffix(userId))
    }

    await Whatsapp.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function addCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)
    
    if (!message.args.length) throw new Error(messageErrorCommandUsage(botInfo, message))

    let userId = addWhatsappSuffix(message.text_command.trim())

    if (!Number(removeWhatsappSuffix(userId))) throw new Error(commandsData.group.add.msgs.error_input)

    let addResponse = await Whatsapp.addParticipant(client, group.id, userId).catch((err) => {
        throw new Error(buildText(commandsData.group.add.msgs.error_invalid_number, removeWhatsappSuffix(userId)))
    })

    if (addResponse.status != "200") throw new Error(buildText(commandsData.group.add.msgs.error_add, removeWhatsappSuffix(userId)))

    const replyText = buildText(commandsData.group.add.msgs.reply, removeWhatsappSuffix(userId))
    await Whatsapp.replyText(client, group.id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function banCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)

    let targetUsers : string[] = []

    if (!message.mentioned.length && message.isQuoted && message.quotedMessage) targetUsers.push(message.quotedMessage?.sender)
    else if (message.mentioned.length) targetUsers = message.mentioned
    else throw new Error(messageErrorCommandUsage(botInfo, message))

    let replyText = commandsData.group.ban.msgs.reply_title

    for(let userId of targetUsers){
        if (group.participants.includes(userId)){
            if (!group.admins.includes(userId)){
                await Whatsapp.removeParticipant(client, group.id, userId)
                replyText += buildText(commandsData.group.ban.msgs.reply_item_success, removeWhatsappSuffix(userId))
            } else {
                replyText += buildText(commandsData.group.ban.msgs.reply_item_ban_admin, removeWhatsappSuffix(userId))
            }
        } else {
            replyText += buildText(commandsData.group.ban.msgs.reply_item_not_found, removeWhatsappSuffix(userId))
        }
    }

    await Whatsapp.replyText(client, group.id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function promoverCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)
    
    let targetUsers : string[] = []
    let replyText = commandsData.group.promover.msgs.reply_title

    if (message.mentioned.length) targetUsers = message.mentioned
    else if (message.isQuoted && message.quotedMessage) targetUsers.push(message.quotedMessage.sender)
    else throw new Error(messageErrorCommandUsage(botInfo, message))

    for(let userId of targetUsers){
        if (!group.admins.includes(userId)) {
            await Whatsapp.promoteParticipant(client, group.id, userId)
            replyText += buildText(commandsData.group.promover.msgs.reply_item_success, removeWhatsappSuffix(userId))
        } else {
            replyText += buildText(commandsData.group.promover.msgs.reply_item_error, removeWhatsappSuffix(userId))
        }
    }

    await Whatsapp.replyWithMentions(client, group.id, replyText, targetUsers, message.wa_message, {expiration: message.expiration})
}

export async function rebaixarCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)
    
    let targetUsers : string[] = []
    let replyText = commandsData.group.rebaixar.msgs.reply_title

    if (message.mentioned.length > 0) targetUsers = message.mentioned
    else if (message.isQuoted && message.quotedMessage) targetUsers.push(message.quotedMessage.sender)
    else throw new Error(messageErrorCommandUsage(botInfo, message))

    for(let userId of targetUsers){
        if (userId == botInfo.host_number || userId == group.owner){
            replyText += buildText(commandsData.group.rebaixar.msgs.reply_item_error, removeWhatsappSuffix(userId))
        } else if (group.admins.includes(userId)) {
            replyText += buildText(commandsData.group.rebaixar.msgs.reply_item_success, removeWhatsappSuffix(userId))
            await Whatsapp.demoteParticipant(client, group.id, userId)
        } else {
            replyText += buildText(commandsData.group.rebaixar.msgs.reply_item_error_is_member, removeWhatsappSuffix(userId))
        }
    }

    await Whatsapp.replyWithMentions(client, message.chat_id, replyText, targetUsers, message.wa_message, {expiration: message.expiration})
}

export async function mtCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    
    let replyMention : string

    if (message.args.length) replyMention = buildText(commandsData.group.mt.msgs.reply_with_message, group.participants.length, message.text_command)
    else replyMention = buildText(commandsData.group.mt.msgs.reply, group.participants.length)

    await Whatsapp.replyWithMentions(client, message.chat_id, replyMention, group.participants, message.wa_message, {expiration: message.expiration})
}

export async function mmCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    
    let replyMention : string
    let groupMembers : string[] = []
    
    group.participants.forEach((participant) => {
        if (!group.admins.includes(participant)) groupMembers.push(participant)
    })

    if (!groupMembers.length) throw new Error(commandsData.group.mm.msgs.error_no_members)

    if (message.args.length) replyMention = buildText(commandsData.group.mm.msgs.reply_with_message, groupMembers.length, message.text_command)
    else replyMention = buildText(commandsData.group.mm.msgs.reply, groupMembers.length)

    await Whatsapp.replyWithMentions(client, message.chat_id, replyMention, groupMembers, message.wa_message, {expiration: message.expiration})
}

export async function admsCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)

    let replyMention : string
    
    if (message.args.length) replyMention = buildText(commandsData.group.adms.msgs.reply_with_message, group.admins.length, message.text_command)
    else replyMention = buildText(commandsData.group.adms.msgs.reply, group.admins.length)

    const messageToReply = (message.isQuoted && message.quotedMessage) ? message.quotedMessage.wa_message : message.wa_message
    await Whatsapp.replyWithMentions(client, message.chat_id, replyMention, group.admins, messageToReply, {expiration: message.expiration})
}

export async function donoCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)

    if (!group.owner) throw new Error(commandsData.group.dono.msgs.error)
    
    const replyText = buildText(commandsData.group.dono.msgs.reply, removeWhatsappSuffix(group.owner))
    await Whatsapp.replyText(client, group.id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function mutarCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    
    let replyText = group.muted ? commandsData.group.mutar.msgs.reply_off : commandsData.group.mutar.msgs.reply_on
    await groupController.setMuted(group.id, !group.muted)
    await Whatsapp.replyText(client, group.id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function linkCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)

    let inviteLink = await Whatsapp.getGroupInviteLink(client, group.id)
    const replyText = buildText(commandsData.group.link.msgs.reply, group.name, inviteLink)
    await Whatsapp.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function rlinkCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)

    await Whatsapp.revokeGroupInvite(client, group.id).catch(() => {
        throw new Error(commandsData.group.rlink.msgs.error)
    })

    const replyText = commandsData.group.rlink.msgs.reply
    await Whatsapp.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function restritoCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)
    
    await Whatsapp.updateGroupRestriction(client, group.id, !group.restricted)
    const replyText = (group.restricted) ? commandsData.group.restrito.msgs.reply_off : commandsData.group.restrito.msgs.reply_on
    await Whatsapp.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function antilinkCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)
    
    const replyText = group.antilink ? commandsData.group.antilink.msgs.reply_off : commandsData.group.antilink.msgs.reply_on
    await groupController.setAntiLink(group.id, !group.antilink)
    await Whatsapp.replyText(client, group.id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function autostickerCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    
    const replyText = group.autosticker ? commandsData.group.autosticker.msgs.reply_off : commandsData.group.autosticker.msgs.reply_on
    await groupController.setAutoSticker(group.id, !group.autosticker)
    await Whatsapp.replyText(client, group.id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function bemvindoCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    
    const replyText = group.welcome.status ? commandsData.group.bemvindo.msgs.reply_off : commandsData.group.bemvindo.msgs.reply_on
    await groupController.setWelcome(group.id, !group.welcome.status, message.text_command || undefined)
    await Whatsapp.replyText(client, group.id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function antifakeCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)
    
    const allowedDDI = !message.args.length ? ["55"] : message.args
    const replyText = group.antifake.status ? commandsData.group.antifake.msgs.reply_off : commandsData.group.antifake.msgs.reply_on
    await groupController.setAntiFake(group.id, !group.antifake.status, allowedDDI)
    await Whatsapp.replyText(client, group.id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function antifloodCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const commandsData = getCommands(botInfo)
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)

    let interval = '10'
    let maxMessage = '10'
                
    if (message.args.length == 2) [maxMessage, interval] = message.args
    else if (message.args.length == 1) [maxMessage] = message.args

    if (!Number(interval) || Number(interval) < 10 || Number(interval) > 60) throw new Error(commandsData.group.antiflood.msgs.error_value_interval)
    if (!Number(maxMessage) || Number(maxMessage) < 5 || Number(maxMessage) > 20) throw new Error(commandsData.group.antiflood.msgs.error_value_message)
    
    const replyText = group.antiflood.status ? commandsData.group.antiflood.msgs.reply_off : buildText(commandsData.group.antiflood.msgs.reply_on, maxMessage, interval)
    await groupController.setAntiFlood(group.id, !group.antiflood.status, Number(maxMessage), Number(interval))
    await Whatsapp.replyText(client, group.id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function apgCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const generalMessages = getGeneralMessages(botInfo)
    const isBotGroupAdmin = group.admins.includes(botInfo.host_number)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!isBotGroupAdmin) throw new Error(generalMessages.permission.bot_group_admin)

    if (!message.isQuoted || !message.quotedMessage) throw new Error(messageErrorCommandUsage(botInfo, message))
    
    await Whatsapp.deleteMessage(client, message.wa_message, true)
}

export async function topativosCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const generalMessages = getGeneralMessages(botInfo)
    const commandsData = getCommands(botInfo)
    let qtyRanking = 10

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!group.counter.status) throw new Error(commandsData.group.topativos.msgs.error_counter)
    if (Number(message.text_command)) qtyRanking = Number(message.text_command)
    if (qtyRanking < 1 || qtyRanking > 50) throw new Error(commandsData.group.topativos.msgs.error_value_limit)
    
    const usersRanking = await groupController.getParticipantsActivityRanking(group, qtyRanking)
    let mentionedUsers = []
    let replyText = buildText(commandsData.group.topativos.msgs.reply_title, qtyRanking)

    for (let i = 0 ; i < usersRanking.length ; i++){
        let icon : string
        let positionRanking = i + 1

        switch(positionRanking){
            case 1:
                icon = '🥇'
            break
            case 2:
                icon = '🥈'
            break
            case 3:
                icon = '🥉'
            break
            default:
                icon = ''
        }

        replyText += buildText(commandsData.group.topativos.msgs.reply_item, icon, positionRanking, removeWhatsappSuffix(usersRanking[i].user_id), usersRanking[i].msgs)
        mentionedUsers.push(usersRanking[i].user_id)   
    }

    await Whatsapp.replyWithMentions(client, message.chat_id, replyText, mentionedUsers, message.wa_message, {expiration: message.expiration})
}

export async function contadorCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const generalMessages = getGeneralMessages(botInfo)
    const commandsData = getCommands(botInfo)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!group.counter.status) await groupController.registerAllParticipantsActivity(group.id, group.participants)

    const replyText = group.counter.status ? commandsData.group.contador.msgs.reply_off : commandsData.group.contador.msgs.reply_on
    await groupController.setCounter(group.id, !group.counter.status)
    await Whatsapp.replyText(client, group.id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function atividadeCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const userController = new UserController()
    const generalMessages = getGeneralMessages(botInfo)
    const commandsData = getCommands(botInfo)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!group.counter.status) throw new Error(commandsData.group.atividade.msgs.error_counter)
    
    let targetUserId : string

    if (message.isQuoted && message.quotedMessage) targetUserId = message.quotedMessage.sender
    else if (message.mentioned.length === 1) targetUserId = message.mentioned[0]
    else throw new Error(messageErrorCommandUsage(botInfo, message))

    let userActivity = await groupController.getParticipantActivity(group.id, targetUserId)

    if (!userActivity){
        if (group.participants.includes(targetUserId)) userActivity = await groupController.registerParticipantActivity(group.id, targetUserId) as ParticipantCounter
        else throw new Error(commandsData.group.atividade.msgs.error_not_member)
    } else {
        if (!group.participants.includes(targetUserId)) throw new Error(commandsData.group.atividade.msgs.error_not_member)
    }

    const userData = await userController.getUser(targetUserId)
    const replyText = buildText(commandsData.group.atividade.msgs.reply, userData?.name || '---', removeWhatsappSuffix(targetUserId), userActivity.msgs, userActivity.text, userActivity.image, userActivity.video, userActivity.sticker, userActivity.audio, userActivity.other)
    await Whatsapp.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function inativosCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const generalMessages = getGeneralMessages(botInfo)
    const commandsData = getCommands(botInfo)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!group.counter.status) throw new Error(commandsData.group.inativos.msgs.error_counter)
    if (!message.args.length) throw new Error(messageErrorCommandUsage(botInfo, message))

    const qtyMessage = Number(message.text_command)

    if (!qtyMessage) throw new Error(commandsData.group.inativos.msgs.error_value_invalid)
    if (qtyMessage < 1) throw new Error(commandsData.group.inativos.msgs.error_value_limit)

    await groupController.registerAllParticipantsActivity(group.id, group.participants)
    let inactiveUsers = await groupController.getParticipantsActivityLowerThan(group, qtyMessage)

    if (!inactiveUsers.length) throw new Error(commandsData.group.inativos.msgs.error_no_inactives)

    let mentionedUsers = []
    let replyText = buildText(commandsData.group.inativos.msgs.reply_title, inactiveUsers.length, qtyMessage)

    for(let user of inactiveUsers){
        replyText += buildText(commandsData.group.inativos.msgs.reply_item, removeWhatsappSuffix(user.user_id), user.msgs)
        mentionedUsers.push(user.user_id)
    }

    await Whatsapp.replyWithMentions(client, group.id, replyText, mentionedUsers, message.wa_message, {expiration: message.expiration})
}

export async function bcmdCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const generalMessages = getGeneralMessages(botInfo)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!message.args.length) throw new Error(messageErrorCommandUsage(botInfo, message))

    const replyText = await groupController.blockCommands(group, message.args, botInfo)
    await Whatsapp.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
}

export async function dcmdCommand(client: WASocket, botInfo: Bot, message: Message, group: Group){
    const groupController = new GroupController()
    const generalMessages = getGeneralMessages(botInfo)

    if (!message.isGroupAdmin) throw new Error(generalMessages.permission.admin_group_only)
    if (!message.args.length) throw new Error(messageErrorCommandUsage(botInfo, message))

    const replyText = await groupController.unblockCommands(group, message.args, botInfo)
    await Whatsapp.replyText(client, message.chat_id, replyText, message.wa_message, {expiration: message.expiration})
}



