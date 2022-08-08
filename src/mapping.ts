import {BigDecimal, BigInt, json, JSONValue, log, near, TypedMap} from "@graphprotocol/graph-ts"
import {
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
        const functionCall = actions[i].toFunctionCall();
        if (functionCall.methodName == "start_game")
            handleStartGame(actions[i], receiptWithOutcome)
        else if (functionCall.methodName == "generate_event")
            handleGenerateEvent(actions[i], receiptWithOutcome)
        else
            log.info("handleReceipt: Invalid method name: {}", [functionCall.methodName])
    }
}


function handleStartGame(
    action: near.ActionValue,
    receiptWithOutcome: near.ReceiptWithOutcome
): void {
    // preparing and validating
    if (action.kind != near.ActionKind.FUNCTION_CALL) {
        log.error("handleStartGame: action is not a function call", []);
        return;
    }
    const functionCall = action.toFunctionCall();
    const methodName = functionCall.methodName

    if (!(methodName == "start_game")) {
        log.error("handleStartGame: Invalid method name: {}", [methodName]);
        return
    }

    // main logic
    const logs = receiptWithOutcome.outcome.logs
    if (logs.length == 0) {
        log.error("handleStartGame: No logs", [])
        return
    }
    if (logs.length != 1) {
        log.error("handleStartGame: Invalid logs length: {}, Must be 1", [logs.length.toString()])
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
    const user1InGameInfo = new UserInGameInfo(user1.id)
    user1InGameInfo.user = user1.id
    updateUserInGameInfo(user1InGameInfo, (gameData.get("user1") as JSONValue).toObject(), game.id)
    const user2InGameInfo = new UserInGameInfo(user2.id)
    user2InGameInfo.user = user2.id


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
    user1.save()
    user2.save()


    game.save()
}


function handleGenerateEvent(
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
    // let gameEvents = game.events != null ? game.events: new Array<string>()
    let gameEvents = game.events
    if (!gameEvents) {
        gameEvents = new Array<string>()
    }
    gameEvents.push(event.id)
    game.events = gameEvents
    game.turns += 1

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
