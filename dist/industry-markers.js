// Alpha 5 belongs exclusively to roads. Industry codes are atlas frame + 1.
export function industryMarker(code){if(!Number.isSafeInteger(code)||code<1||code>253)throw RangeError('Invalid industry code');return code<=3?code+1:code+2;}
export function industryCode(marker){return marker>=2&&marker<=4?marker-1:marker>=6?marker-2:0;}
