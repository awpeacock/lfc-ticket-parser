export const Constants = {
    ENV_DEV: 'Dev',
    ENV_TEST: 'Test',
    ENV_PROD: 'Production',

    FORMATS: [2024, 2026],

    DATABASE: 'DynamoDB',
    TABLE_SALES: 'LFCT-Sales',
    TABLE_BACKUP: 'LFCT-Backup',
}

export const GetFormat = (): number => {
    let format: number = Constants.FORMATS[Constants.FORMATS.length-1];
    if ( process.env.HTML_FORMAT ) {
        const year = parseInt(process.env.HTML_FORMAT);
        if (!isNaN(year)) {
            let latest = Constants.FORMATS[0];
            for ( let f = 1; f < Constants.FORMATS.length; f++ ) {
                if ( year >= Constants.FORMATS[f]) {
                    latest = Constants.FORMATS[f];
                }
            }
            format = latest;
        }
    }
    return format;
}