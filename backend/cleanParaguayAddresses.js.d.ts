declare module '../backend/cleanParaguayAddresses.js' {
    export function cleanParaguayAddresses(apiKey: string, csvData: string): Promise<string>
}
