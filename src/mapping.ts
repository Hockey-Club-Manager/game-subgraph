import {json, log, near} from "@graphprotocol/graph-ts"


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
    // TODO: write the main logic

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