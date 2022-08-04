import {json, log, near, JSONValue} from "@graphprotocol/graph-ts"
import {User, UserStatistics, UserInGameInfo, Game,
    FiveInfo, Five, Team, Goalie, FieldPlayer, Event} from "../generated/schema"


export function handleReceipt(
    receiptWithOutcome: near.ReceiptWithOutcome
): void {
    const actions = receiptWithOutcome.receipt.actions;
    for (let i = 0; i < actions.length; i++) {
        const functionCall = actions[i].toFunctionCall();
        switch (functionCall.methodName) {
            case "start_game":
                handleStartGame(actions[i], receiptWithOutcome);
                break;
            case "generate_event":
                handleGenerateEvent(actions[i], receiptWithOutcome);
                break;
            default:
                log.info("handleReceipt: Invalid method name: {}", [functionCall.methodName]);
        }
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

    const outcome = receiptWithOutcome.outcome;
    const args = json.fromString(functionCall.args.toString()).toObject()

    // main logic
    const logs = outcome.logs
    if (logs.length == 0) {
        log.error("handleStartGame: No logs", [])
        return
    }
    let user1: User | null = null
    let user2: User | null = null
    // {"game_id": 54, "account_id": parh.testnet, "opponent_id": nft.testnet}
    for (let i = 0; i < logs.length; i++) {
        const log = logs[i]
        const logData = json.fromString(log).toObject()
        user1 = User.load((logData.get("account_id") as JSONValue).toString())
        if (!user1) {
            user1 = new User((logData.get("account_id") as JSONValue).toString())
        }
        user2 = User.load((logData.get("opponent_id") as JSONValue).toString())
        if (!user2) {
            user2 = new User((logData.get("opponent_id") as JSONValue).toString())
        }
        // let game = Game.load((logData.get("game_id") as JSONValue).toI64().toString())
    }

    if (user1 == null || user2 == null) {
        log.error("handleStartGame: user1 or user2 is null", [])
        return
    }
    user1.save()
    user2.save()


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
    // TODO: write the main logic
}