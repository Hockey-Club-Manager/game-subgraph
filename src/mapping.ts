import {BigDecimal, BigInt, json, JSONValue, log, near, store, TypedMap} from "@graphprotocol/graph-ts"
import {
    AccountWithDeposit,
    Event,
    FieldPlayer,
    Five,
    Game,
    Goalie,
    PlayerOnPosition,
    Team,
    User,
    UserInGameInfo,
    UserStatistics
} from "../generated/schema"
import {typedMapToString} from "./utils"

function deleteObjFromArray<T>(array: T[], str: T): T[] {
    const index = array.indexOf(str)
    if (index > -1) {
        array.splice(index, 1)
    }
    return array
}


function addObjToArray<T>(array: T[] | null, obj: T): T[] {
    if (array == null) {
        array = new Array<T>()
    }
    array.push(obj)
    return array
}

function getEventId(gameId: string, events_count: number): string {
    return gameId + (events_count + 1).toString()
}

function getPlayerOnPositionId(fiveId: string, position: string): string {
    return `${fiveId}_${position}`
}

function getFiveId(gameId: string, userId: string, fiveNumber: string): string {
    return `${gameId}_${userId}_${fiveNumber}`
}

function getUserInGameInfoId(userId: string, gameId: string): string {
    // id is game_id + _ + user_id. For example: 12345_1 or 12345_2 for user 1 and 2 correspondingly in game 12345
    return `${gameId}_${userId}`
}

function getPlayerId(tokenId: string, gameId: string): string {
    return `${tokenId}_${gameId}`
}

function getAccountWithDepositId(accountId: string, friendId: string): string {
    return `${accountId}|${friendId}`
}

function updateUserInGameInfo(userInGameInfo: UserInGameInfo, userInGameInfoData: TypedMap<string, JSONValue>, gameId: string): void {
    // field "user" must be set before calling this function
    const userId = userInGameInfoData.get("user_id")!.toI64() as number
    userInGameInfo.take_to_called = (userInGameInfoData.get("take_to_called") as JSONValue).toBool()
    userInGameInfo.coach_speech_called = (userInGameInfoData.get("coach_speech_called") as JSONValue).toBool()
    userInGameInfo.is_goalie_out = (userInGameInfoData.get("is_goalie_out") as JSONValue).toBool()

    let team = Team.load(userInGameInfo.id)
    if (!team)
        team = new Team(userInGameInfo.id)

    userInGameInfo.team = team.id
    let fives = new Array<string>()
    const teamData = (userInGameInfoData.get("team") as JSONValue).toObject()

    const fieldPlayersData = (teamData.get("field_players") as JSONValue).toObject()
    for (let i = 0; i < fieldPlayersData.entries.length; i++) {
        // init or load FieldPlayers from userInGameInfoData. Structure is written in example.json
        let fieldPlayerData = (fieldPlayersData.entries[i].value as JSONValue).toObject()
        let fieldPlayer = FieldPlayer.load(getPlayerId(fieldPlayersData.entries[i].key, gameId))
        if (!fieldPlayer) {
            fieldPlayer = new FieldPlayer(getPlayerId(fieldPlayersData.entries[i].key, gameId))
            fieldPlayer.user_in_game_info = userInGameInfo.id
        }
        if (fieldPlayersData.get(fieldPlayersData.entries[i].key)!.toObject().get("img") == null)
            fieldPlayer.img = null
        else fieldPlayer.img = (fieldPlayerData.get("img") as JSONValue).toString()

        fieldPlayer.name = (fieldPlayerData.get("name") as JSONValue).toString()
        fieldPlayer.teamwork = BigDecimal.fromString((fieldPlayerData.get("teamwork") as JSONValue).toF64().toString())
        fieldPlayer.reality = (fieldPlayerData.get("reality") as JSONValue).toBool()
        fieldPlayer.nationality = fieldPlayerData.get("nationality")!.toString()
        fieldPlayer.birthday = fieldPlayerData.get("birthday")!.toBigInt()
        fieldPlayer.player_type = fieldPlayerData.get("player_type")!.toString()
        fieldPlayer.number = fieldPlayerData.get("number")!.toI64() as i32
        fieldPlayer.hand = fieldPlayerData.get("hand")!.toString()
        fieldPlayer.player_role = fieldPlayerData.get("player_role")!.toString()
        fieldPlayer.native_position = fieldPlayerData.get("native_position")!.toString()
        fieldPlayer.number_of_penalty_events = fieldPlayerData.get("number_of_penalty_events")!.toBigInt()

        const stats = fieldPlayerData.get("stats")!.toObject()
        fieldPlayer.stats = typedMapToString(stats)
        fieldPlayer.save()
    }

    const fivesData = (teamData.get("fives") as JSONValue).toObject()
    for (let i = 0; i < fivesData.entries.length; i++) {
        const fiveNumber = fivesData.entries[i].key
        const fiveData = fivesData.get(fiveNumber)!.toObject()
        let five = Five.load(getFiveId(gameId, userId.toString(), fiveNumber))
        if (!five) {
            five = new Five(getFiveId(gameId, userId.toString(), fiveNumber))
        }

        const fiveFieldPlayers = new Array<string>()
        const fieldPlayers = fiveData.get("field_players")!.toObject()
        for (let j = 0; j < fieldPlayers.entries.length; j++) {
            const entry = fieldPlayers.entries[j]
            let playerOnPosition = PlayerOnPosition.load(getPlayerOnPositionId(five.id, entry.key))
            if (!playerOnPosition) {
                playerOnPosition = new PlayerOnPosition(getPlayerOnPositionId(five.id, entry.key))
            }
            playerOnPosition.position = entry.key
            if (entry.value.isNull()) {
                playerOnPosition.player = null
            } else {
                playerOnPosition.player = getPlayerId(entry.value.toString(), gameId)
            }
            playerOnPosition.save()
            fiveFieldPlayers.push(playerOnPosition.id)
        }
        five.field_players = fiveFieldPlayers
        five.number = fiveNumber
        five.ice_time_priority = fiveData.get("ice_time_priority")!.toString()
        five.tactic = fiveData.get("tactic")!.toString()
        five.time_field = fiveData.get("time_field")!.toI64() as i32

        fives.push(five.id)
    }

    const goalies: Array<string> = new Array<string>()
    const goaliesData = (teamData.get("goalies") as JSONValue).toObject()
    for (let i = 0; i < goaliesData.entries.length; i++) {
        const goalieData = (goaliesData.entries[i].value as JSONValue).toObject()
        const goalieNumber = goaliesData.entries[i].key  // MainGoalkeeper or SubstituteGoalkeeper
        let goalie = Goalie.load(getPlayerId(goalieData.get("id")!.toString(), gameId))
        if (!goalie) {
            goalie = new Goalie(getPlayerId(goalieData.get("id")!.toString(), gameId))
        }
        goalie.name = goalieData.get("name")!.toString()
        goalie.img = goalieData.get("img")!.toString()
        goalie.stats = typedMapToString(goalieData.get("stats")!.toObject())
        goalie.reality = (goalieData.get("reality") as JSONValue).toBool()
        goalie.nationality = goalieData.get("nationality")!.toString()
        goalie.birthday = goalieData.get("birthday")!.toBigInt()
        goalie.player_type = goalieData.get("player_type")!.toString()
        goalie.player_role = goalieData.get("player_role")!.toString()
        goalie.hand = goalieData.get("hand")!.toString()
        goalie.goalie_number = goalieNumber
        goalie.number = goalieData.get("number")!.toI64() as i32

        goalie.save()
        goalies.push(goalie.id)
    }

    team.score = (teamData.get("score") as JSONValue).toI64() as i32
    team.fives = fives
    team.active_five = teamData.get("active_five")!.toString()
    team.active_goalie = teamData.get("active_goalie")!.toString()
    team.goalies = goalies
    const penaltyPlayers = new Array<string>()

    const penaltyPlayersData = (teamData.get("penalty_players") as JSONValue).toArray()

    for (let i = 0; i < penaltyPlayersData.length; i++) {
        const element = penaltyPlayersData[i]
        penaltyPlayers.push(getPlayerId(element.toString(), gameId))
    }
    team.penalty_players = penaltyPlayers
    team.save()
    userInGameInfo.save()
}

// function validateHandlerAction(functionName: string, handlerName: string, action: near.ActionValue): boolean {
//
// }


function initUserStatistics(statistics: UserStatistics): void {
    statistics.victories = 0
    statistics.losses = 0
    statistics.total_reward = BigInt.fromI32(0)
    statistics.total_loss = BigInt.fromI32(0)
    statistics.total_goals = 0
    statistics.total_misses = 0
}

export function handleReceipt(
    receiptWithOutcome: near.ReceiptWithOutcome
): void {
    const actions = receiptWithOutcome.receipt.actions;
    for (let i = 0; i < actions.length; i++) {
        if (actions[i].kind != near.ActionKind.FUNCTION_CALL) {
            continue
        }
        const functionCall = actions[i].toFunctionCall();
        if (functionCall.methodName == "make_available")
            handleMakeAvailable(actions[i], receiptWithOutcome)
        if (functionCall.methodName == "make_unavailable")
            handleMakeUnavailable(actions[i], receiptWithOutcome)
        else if (functionCall.methodName == "generate_event")
            handleGenerateEvent(actions[i], receiptWithOutcome)
        else if (functionCall.methodName == "register_account")
            handleRegisterAccountEvent(actions[i], receiptWithOutcome)
        else if (functionCall.methodName == "send_friend_request")
            handleSendFriendRequestEvent(actions[i], receiptWithOutcome)
        else if (functionCall.methodName == "accept_friend_request")
            handleAcceptFriendRequestEvent(actions[i], receiptWithOutcome)
        else if (functionCall.methodName == "decline_friend_request")
            handleDeclineFriendRequestEvent(actions[i], receiptWithOutcome)
        else if (functionCall.methodName == "send_request_play")
            handleSendRequestPlayEvent(actions[i], receiptWithOutcome)
        else if (functionCall.methodName == "accept_request_play")
            handleAcceptOrDeclineRequestPlayEvent(actions[i], receiptWithOutcome)
        else if (functionCall.methodName == "decline_request_play")
            handleAcceptOrDeclineRequestPlayEvent(actions[i], receiptWithOutcome)
        else if (functionCall.methodName == "remove_friend") {
            handleRemoveFriendEvent(actions[i], receiptWithOutcome)
        }
        else
            log.info("handleReceipt: Invalid method name: {}", [functionCall.methodName])
    }
}

function handleMakeUnavailable(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    // preparing and validating
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleMakeUnavailable: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "make_unavailable")) {
        log.error("handleMakeUnavailable: Invalid method name: {}", [methodName]);
        return
    }
    const userId = receiptWithOutcome.receipt.signerId;
    if (!User.load(userId)) {
        log.error("handleMakeUnavailable: User is not registered", []);
        return
    }
    const user = User.load(userId)!
    user.deposit = BigInt.fromI32(0)
    user.is_available = false
    user.save()
}

function handleMakeAvailable (
    action: near.ActionValue,
    receiptWithOutcome: near.ReceiptWithOutcome
): void {
    // preparing and validating
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleMakeAvailable: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "make_available")) {
        log.error("handleMakeAvailable: Invalid method name: {}", [methodName]);
        return
    }

    // main logic
    const logs = receiptWithOutcome.outcome.logs
    if (logs.length == 0) {
        const userId = receiptWithOutcome.receipt.signerId;
        let user = User.load(userId)
        if (!user) {
            user = new User(userId)
            user.games = new Array<string>()
            const statistics1 = new UserStatistics(user.id)
            initUserStatistics(statistics1)
            user.statistics = statistics1.id
            statistics1.save()
            user.friend_requests_received = new Array<string>()
            user.sent_friend_requests = new Array<string>()
            user.friends = new Array<string>()
            user.sent_requests_play = new Array<string>()
            user.requests_play_received = new Array<string>()
        }
        user.deposit = functionCall.deposit
        user.is_available = true
        user.save()
        return
    }
    if (logs.length != 1) {
        log.error("handleMakeAvailable: Invalid logs length: {}, Must be empty or 1", [logs.length.toString()])
        return
    }

    if (json.try_fromString(logs[0]).error == true) {
        log.error("handleMakeAvailable: Invalid logs: {}", [logs[0]])
        return
    }
    const logData = json.fromString(logs[0]).toObject()
    const gameData = (logData.get("game") as JSONValue).toObject()
    let game = new Game((gameData.get("game_id") as JSONValue).toString())

    let user1: User | null
    let user2: User | null

    // getting or creating user1 and user2
    user1 = User.load((gameData.get("user1") as JSONValue).toString())
    if (!user1) {
        user1 = new User(((gameData.get("user1") as JSONValue).toObject().get("user_id") as JSONValue).toBigInt().toString())
        const statistics1 = new UserStatistics(user1.id)
        initUserStatistics(statistics1)
        user1.statistics = statistics1.id
        statistics1.save()
    }

    user2 = User.load((logData.get("opponent_id") as JSONValue).toString())
    if (!user2) {
        user2 = new User(((gameData.get("user2") as JSONValue).toObject().get("user_id") as JSONValue).toBigInt().toString())
        const statistics2 = new UserStatistics(user2.id)
        initUserStatistics(statistics2)
        user2.statistics = statistics2.id
        statistics2.save()
    }

    // creating UserInGameInfo for both users
    const user1InGameInfo = new UserInGameInfo(getUserInGameInfoId(user1.id, game.id))
    user1InGameInfo.user = user1.id
    updateUserInGameInfo(user1InGameInfo, (gameData.get("user1") as JSONValue).toObject(), game.id)
    const user2InGameInfo = new UserInGameInfo(getUserInGameInfoId(user2.id, game.id))
    user2InGameInfo.user = user2.id
    updateUserInGameInfo(user1InGameInfo, (gameData.get("user2") as JSONValue).toObject(), game.id)


    // setting necessary game's fields
    game.user1 = user1InGameInfo.id
    game.user2 = user2InGameInfo.id
    game.reward = (gameData.get("reward") as JSONValue).toBigInt()
    game.winner_index = (gameData.get("winner_index") as JSONValue).toI64() as i32
    game.last_event_generation_time = (gameData.get("last_event_generation_time") as JSONValue).toBigInt()
    game.zone_number = (gameData.get("zone_number") as JSONValue).toI64() as i32
    game.turns = (gameData.get("turns") as JSONValue).toI64() as i32
    game.events = null
    const playerWithPuck = gameData.get("player_with_puck")
    if (playerWithPuck)
        game.player_with_puck = getPlayerId(playerWithPuck.toArray()[1].toString(), game.id)
    else
        game.player_with_puck = null


    // adding game to User.games for both users
    let games = user1.games
    games.push(game.id)
    user1.games = games
    games = user2.games
    games.push(game.id)
    user2.games = games

    user1.is_available = false
    user2.is_available = false
    user1.deposit = BigInt.fromI32(0)
    user2.deposit = BigInt.fromI32(0)

    user1.friend_requests_received = new Array<string>()
    user1.sent_friend_requests = new Array<string>()
    user1.friends = new Array<string>()
    user1.sent_requests_play = new Array<string>()
    user1.requests_play_received = new Array<string>()

    user2.friend_requests_received = new Array<string>()
    user2.sent_friend_requests = new Array<string>()
    user2.friends = new Array<string>()
    user2.sent_requests_play = new Array<string>()
    user2.requests_play_received = new Array<string>()

    user1.save()
    user2.save()

    game.save()
}


function handleGenerateEvent (
    action: near.ActionValue,
    receiptWithOutcome: near.ReceiptWithOutcome
): void {

    // preparing and validating
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleGenerateEvent: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "generate_event")) {
        log.error("handleGenerateEvent: Invalid method name: {}", [methodName]);
        return
    }

    const outcome = receiptWithOutcome.outcome;
    const args = json.fromString(functionCall.args.toString()).toObject()

    // main logic
    const gameId = (args.get("game_id") as JSONValue).toI64() as i32

    // {"generated_event": Event, "stop_game": game_id(int) | null, "winner_id": winner_id(String) | null, "reward": String}
    if (outcome.logs.length == 0) {
        log.error("handleGenerateEvent: No logs", [])
        return
    }
    const logData = json.fromString(outcome.logs[0]).toObject()
    const eventData = (logData.get("generated_event") as JSONValue).toObject()
    const game = Game.load(gameId.toString()) as Game
    let stopGame: string | null = null
    let winnerId: string | null = null
    if (logData.get("stop_game") != null) {
        stopGame = (logData.get("stop_game") as JSONValue).toBigInt().toString()
        winnerId = (logData.get("winner_id") as JSONValue).toString()
    }
    if (stopGame) {
        const lastEvent = Event.load(game.events!.at(-1)) as Event
        if (lastEvent.action == "GameFinished")
            return
        else log.error("handleGenerateEvent: Game is not finished, but stop_game field was retrieved", [])
    }

    // creating event
    let event: Event;
    if (game.events) {
        event = new Event(getEventId(eventData.get("event_id")!.toString(), game.events!.length))
    } else {
        event = new Event(getEventId(eventData.get("event_id")!.toString(), 0))
    }
    event.player_with_puck = getPlayerId(eventData.get("player_with_puck")!.toArray()[1].toString(), game.id)
    event.action = eventData.get("action")!.toString()
    event.zone_number = eventData.get("zone_number")!.toI64() as i32
    event.time = eventData.get("time")!.toBigInt()

    const userInGameInfo1 = UserInGameInfo.load(game.user1.toString()) as UserInGameInfo
    const userInGameInfo2 = UserInGameInfo.load(game.user2.toString()) as UserInGameInfo

    updateUserInGameInfo(userInGameInfo1, eventData.get("user1")!.toObject(), game.id)
    updateUserInGameInfo(userInGameInfo2, eventData.get("user2")!.toObject(), game.id)
    event.user1 = userInGameInfo1.id
    event.user2 = userInGameInfo2.id

    event.save()

    // updating game
    let gameEvents = game.events
    if (!gameEvents) {
        gameEvents = new Array<string>()
    }
    gameEvents.push(event.id)
    game.events = gameEvents
    game.turns += 1
    game.last_event_generation_time = event.time

    if (event.action == "Goal") {
        const fieldPlayerWithPuck = FieldPlayer.load(getPlayerId(eventData.get("player_with_puck")!.toArray()[1].toString(), game.id))!
        let winner: UserInGameInfo
        let loser: UserInGameInfo
        if (fieldPlayerWithPuck.user_in_game_info == userInGameInfo1.id) {
            winner = userInGameInfo1
            loser = userInGameInfo2
        } else {
            winner = userInGameInfo2
            loser = userInGameInfo1
        }
        const userShotGoal = User.load(winner.user)!;
        const statisticsWinner = UserStatistics.load(userShotGoal.statistics)!
        statisticsWinner.total_goals += 1
        statisticsWinner.save()
        const userMissedGoal = User.load(loser.user)!
        const statisticsLooser = UserStatistics.load(userMissedGoal.statistics)!
        statisticsLooser.total_misses += 1
        statisticsLooser.save()
    }

    // if game finished
    if (event.action == "GameFinished") {
        const winnerId = eventData.get("winner_id")!.toString()
        const winner = User.load(winnerId) as User
        const loser = User.load(winnerId == userInGameInfo1.user ? userInGameInfo2.user : userInGameInfo1.user) as User
        const reward = eventData.get("reward")!.toBigInt()
        const winnerStatistics = UserStatistics.load(winner.statistics.toString()) as UserStatistics
        const loserStatistics = UserStatistics.load(loser.statistics.toString()) as UserStatistics
        winnerStatistics.victories += 1
        loserStatistics.losses += 1
        // @ts-ignore
        winnerStatistics.total_reward = winnerStatistics.total_reward + reward
        // @ts-ignore
        loserStatistics.total_loss = loserStatistics.total_loss + reward
        winnerStatistics.save()
        loserStatistics.save()
        winner.save()
        loser.save()
        game.winner_index = userInGameInfo1.user == winnerId ? 1 : 2
        game.reward = reward
    }
    game.save()
}

function handleRegisterAccountEvent(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleRegisterAccountEvent: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "register_account")) {
        log.error("handleRegisterAccountEvent: Invalid method name: {}", [methodName]);
        return
    }

    let account = User.load(receiptWithOutcome.receipt.signerId)
    if (!account) {
        account = new User(receiptWithOutcome.receipt.signerId)
        account.is_available = false;
        const statistics = new UserStatistics(account.id)
        initUserStatistics(statistics)
        account.statistics = statistics.id
        statistics.save()
        account.deposit = BigInt.fromI32(0)
        account.games = new Array<string>()
        account.friend_requests_received = new Array<string>()
        account.sent_friend_requests = new Array<string>()
        account.friends = new Array<string>()
        account.sent_requests_play = new Array<string>()
        account.requests_play_received = new Array<string>()
        account.save()
    }
}

function handleSendFriendRequestEvent(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleSendFriendRequestEvent: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "send_friend_request")) {
        log.error("handleSendFriendRequestEvent: Invalid method name: {}", [methodName]);
        return
    }

    const outcome = receiptWithOutcome.outcome;
    const args = json.fromString(functionCall.args.toString()).toObject()
    // pub fn send_friend_request (&mut self, friend_id: &AccountId)
    const friendId = args.get("friend_id")!.toString()
    const account = User.load(receiptWithOutcome.receipt.signerId)
    if (!account) {
        log.error("handleSendFriendRequestEvent: User not found", [])
        return
    }
    const friend = User.load(friendId)
    if (!friend) {
        log.error("handleSendFriendRequestEvent: Friend not found", [])
        return
    }
    if (account.sent_friend_requests.includes(friendId)) {
        log.error("handleSendFriendRequestEvent: Friend request already sent", [])
        return
    }
    account.sent_friend_requests = addObjToArray(account.sent_friend_requests, friendId)
    friend.friend_requests_received = addObjToArray(friend.friend_requests_received, receiptWithOutcome.receipt.signerId)
    account.save()
    friend.save()
}

function handleAcceptFriendRequestEvent(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleAcceptFriendRequestEvent: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "accept_friend_request")) {
        log.error("handleAcceptFriendRequestEvent: Invalid method name: {}", [methodName]);
        return
    }

    const outcome = receiptWithOutcome.outcome;
    const args = json.fromString(functionCall.args.toString()).toObject()
    // pub fn accept_friend_request (&mut self, friend_id: &AccountId)
    const friendId = args.get("friend_id")!.toString()
    const account = User.load(receiptWithOutcome.receipt.signerId)
    if (!account) {
        log.error("handleAcceptFriendRequestEvent: User not found", [])
        return
    }
    const friend = User.load(friendId)
    if (!friend) {
        log.error("handleAcceptFriendRequestEvent: Friend not found", [])
        return
    }
    if (!friend.sent_friend_requests.includes(account.id)) {
        log.error("handleAcceptFriendRequestEvent: Friend request not sent", [])
        return
    }
    friend.sent_friend_requests = deleteObjFromArray(friend.sent_friend_requests, account.id)
    account.friends = addObjToArray(account.friends, friendId)
    friend.friends = addObjToArray(friend.friends, account.id)
    account.friend_requests_received = deleteObjFromArray(account.sent_friend_requests, account.id)
    account.save()
    friend.save()
}

function handleDeclineFriendRequestEvent(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleDeclineFriendRequestEvent: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "decline_friend_request")) {
        log.error("handleDeclineFriendRequestEvent: Invalid method name: {}", [methodName]);
        return
    }

    const outcome = receiptWithOutcome.outcome;
    const args = json.fromString(functionCall.args.toString()).toObject()
    // pub fn decline_friend_request (&mut self, friend_id: &AccountId)
    const friendId = args.get("friend_id")!.toString()
    const account = User.load(receiptWithOutcome.receipt.signerId)
    if (!account) {
        log.error("handleDeclineFriendRequestEvent: User not found", [])
        return
    }
    const friend = User.load(friendId)
    if (!friend) {
        log.error("handleDeclineFriendRequestEvent: Friend not found", [])
        return
    }
    if (friend.sent_friend_requests.includes(account.id)) {
        log.warning("Declining", [])
        friend.sent_friend_requests = deleteObjFromArray(friend.sent_friend_requests, account.id)
        account.friend_requests_received = deleteObjFromArray(account.friend_requests_received, friendId)
    } else if (account.sent_friend_requests.includes(friendId)) {
        friend.friend_requests_received = deleteObjFromArray(friend.friend_requests_received, account.id)
        account.sent_friend_requests = deleteObjFromArray(account.sent_friend_requests, friendId)
    } else {
        log.error("handleDeclineFriendRequestEvent: Friend request not sent", [])
        return
    }
    account.save()
    friend.save()
}

function handleSendRequestPlayEvent(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleSendRequestPlayEvent: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "send_request_play")) {
        log.error("handleSendRequestPlayEvent: Invalid method name: {}", [methodName]);
        return
    }

    const outcome = receiptWithOutcome.outcome;
    const args = json.fromString(functionCall.args.toString()).toObject()
    // pub fn send_request_play (&mut self, friend_id: &AccountId)
    const friendId = args.get("friend_id")!.toString()
    const account = User.load(receiptWithOutcome.receipt.signerId)
    if (!account) {
        log.error("handleSendRequestPlayEvent: User not found", [])
        return
    }
    const friend = User.load(friendId)
    if (!friend) {
        log.error("handleSendRequestPlayEvent: Friend not found", [])
        return
    }
    if (account.sent_requests_play.includes(getAccountWithDepositId(account.id, friendId)) || friend.sent_requests_play.includes(getAccountWithDepositId(friendId, account.id))) {
        log.error("handleSendRequestPlayEvent: Request already sent", [])
        return
    }
    let accountWithDeposit = AccountWithDeposit.load(getAccountWithDepositId(account.id, friendId))
    if (!accountWithDeposit) {
        accountWithDeposit = new AccountWithDeposit(getAccountWithDepositId(account.id, friendId))
    }
    accountWithDeposit.deposit = functionCall.deposit
    accountWithDeposit.from = account.id
    accountWithDeposit.to = friendId
    account.sent_requests_play = addObjToArray(account.sent_requests_play, accountWithDeposit.id)
    friend.requests_play_received = addObjToArray(friend.requests_play_received, accountWithDeposit.id)
    account.save()
    friend.save()
    accountWithDeposit.save()
}

function handleAcceptOrDeclineRequestPlayEvent(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleAcceptOrDeclineRequestPlayEvent: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "accept_request_play") && !(methodName == "decline_request_play")) {
        log.error("handleAcceptOrDeclineRequestPlayEvent: Invalid method name: {}", [methodName]);
        return
    }

    const outcome = receiptWithOutcome.outcome;
    const args = json.fromString(functionCall.args.toString()).toObject()
    // pub fn accept_request_play (&mut self, friend_id: &AccountId)
    const friendId = args.get("friend_id")!.toString()
    const account = User.load(receiptWithOutcome.receipt.signerId)
    if (!account) {
        log.error("handleAcceptOrDeclineRequestPlayEvent: User not found", [])
        return
    }
    const friend = User.load(friendId)
    if (!friend) {
        log.error("handleAcceptOrDeclineRequestPlayEvent: Friend not found", [])
        return
    }
    let accountWithDeposit: AccountWithDeposit | null;
    if (account.requests_play_received.includes(getAccountWithDepositId(friendId, account.id))) {
        accountWithDeposit = AccountWithDeposit.load(getAccountWithDepositId(friendId, account.id))
        if (!accountWithDeposit) {
            log.error("handleAcceptOrDeclineRequestPlayEvent: AccountWithDeposit not found", [])
            return
        }
        friend.sent_requests_play = deleteObjFromArray(friend.sent_requests_play, accountWithDeposit.id)
        account.requests_play_received = deleteObjFromArray(account.requests_play_received, accountWithDeposit.id)
        store.remove("AccountWithDeposit", accountWithDeposit.id)
    } else if (account.sent_requests_play.includes(getAccountWithDepositId(account.id, friendId))) {
        if (methodName == "accept_request_play") {
            log.error("handleAcceptOrDeclineRequestPlayEvent: You can't accept your own request", [])
            return
        }
        accountWithDeposit = AccountWithDeposit.load(getAccountWithDepositId(account.id, friendId))
        if (!accountWithDeposit) {
            log.error("handleAcceptOrDeclineRequestPlayEvent: AccountWithDeposit not found", [])
            return
        }
        friend.requests_play_received = deleteObjFromArray(friend.requests_play_received, accountWithDeposit.id)
        account.sent_requests_play = deleteObjFromArray(account.sent_requests_play, accountWithDeposit.id)
        store.remove("AccountWithDeposit", accountWithDeposit.id)
    } else {
        log.error("handleAcceptOrDeclineRequestPlayEvent: Request not sent", [])
        return
    }
    account.save()
    friend.save()
}

// function handleDeclineRequestPlayEvent(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
//     if (action.kind != near.ActionKind.FUNCTION_CALL) {
//         log.error("handleDeclineRequestPlayEvent: action is not a function call", []);
//         return;
//     }
//     const functionCall = action.toFunctionCall();
//     const methodName = functionCall.methodName
//
//     if (!(methodName == "decline_request_play")) {
//         log.error("handleDeclineRequestPlayEvent: Invalid method name: {}", [methodName]);
//         return
//     }
//
//     const outcome = receiptWithOutcome.outcome;
//     const args = json.fromString(functionCall.args.toString()).toObject()
//     // pub fn decline_request_play (&mut self, friend_id: &AccountId)
//     const friendId = args.get("friend_id")!.toString()
//     const account = User.load(receiptWithOutcome.receipt.signerId) as User
//     if (!account) {
//         log.error("handleDeclineRequestPlayEvent: User not found", [])
//         return
//     }
//     const friend = User.load(friendId) as User
//     if (!friend) {
//         log.error("handleDeclineRequestPlayEvent: Friend not found", [])
//         return
//     }
//     if (!friend.sent_requests_play.includes(friendId)) {
//         log.error("handleDeclineRequestPlayEvent: Request not sent", [])
//         return
//     }
//     friend.sent_requests_play = deleteObjFromArray(friend.sent_requests_play, account.id)
//     account.requests_play_received = deleteObjFromArray(account.requests_play_received, friendId)
//     account.save()
//     friend.save()
// }

function handleRemoveFriendEvent(action: near.ActionValue, receiptWithOutcome: near.ReceiptWithOutcome): void {
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleRemoveFriendEvent: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "send_friend_request")) {
        log.error("handleRemoveFriendEvent: Invalid method name: {}", [methodName]);
        return
    }

    const outcome = receiptWithOutcome.outcome;
    const args = json.fromString(functionCall.args.toString()).toObject()
    // pub fn send_friend_request (&mut self, friend_id: &AccountId)
    const friendId = args.get("friend_id")!.toString()
    const account = User.load(receiptWithOutcome.receipt.signerId)
    if (!account) {
        log.error("handleRemoveFriendEvent: User not found", [])
        return
    }
    const friend = User.load(friendId)
    if (!friend) {
        log.error("handleRemoveFriendEvent: Friend not found", [])
        return
    }
    if (!account.friends.includes(friendId)) {
        log.error("handleRemoveFriendEvent: Friend not added", [])
        return
    }
    account.friends = deleteObjFromArray(account.friends, friendId)
    friend.friends = deleteObjFromArray(friend.friends, account.id)
    account.save()
    friend.save()
}
