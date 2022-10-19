import {JSONValue, TypedMap, JSONValueKind, ValueKind, Value, log} from "@graphprotocol/graph-ts";

export function typedMapToString(typedMap: TypedMap<string, JSONValue>): string {
    let string = "{"
    for (let i = 0; i < typedMap.entries.length; i++) {
        let value = typedMap.entries[i].value
        let stringValue: string;
        switch (value.kind) {
            case JSONValueKind.STRING:
                stringValue = value.toString()
                break
            case JSONValueKind.OBJECT:
                stringValue = typedMapToString(value.toObject())
                break
            case JSONValueKind.ARRAY:
                stringValue = value.toArray().toString()
                break
            case JSONValueKind.BOOL:
                stringValue = value.toBool().toString()
                break
            case JSONValueKind.NUMBER:
                stringValue = value.toI64().toString()
        }

        if (typedMap.entries[i].value.isNull())
            stringValue = "null"
        string += `"${typedMap.entries[i].key}": ${stringValue!}`
        if (i != typedMap.entries.length - 1)
            string += ", "
    }
    string += "}"
    return string
}
