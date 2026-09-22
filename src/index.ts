import dotenv from 'dotenv';
import * as ICS from 'ics';
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';


import { Narrator } from '@redpenguinstudio/herbert';

import { Constants } from './constants';
import { FixtureList } from "./fixtures";
import { PersistenceFactory, Client, Backup } from './persistence';
import { Email } from './distribution';

class TicketParser {

    static async parse(environment: string): Promise<void> {

        const email:Email = new Email();
        const fixtures: FixtureList = new FixtureList();

        // Initialise the DB in a separate try/catch loop - if an unexpected error
        // occurs we don't want it to impact sending the email
        let client: Client, persistable: boolean = false, retry: Nullable<Backup> = null;
        const keys: Array<string> = new Array<string>();
        try {
            const db: Database = (process.env.DB_CLIENT || Constants.DATABASE) as Database;
            const table: string = (process.env.DB_TABLE || Constants.TABLE_SALES) as string;
            const backup: string = (process.env.DB_BACKUP || Constants.TABLE_BACKUP) as string;
            if ( environment == null || db == null || table == null || backup == null ) {
                throw new Error('No database variables set');
            }
            Narrator.heading('Initialising "' + db + '" database');
            client = PersistenceFactory.getClient(db, table + '-' + environment, backup + '-' + environment);
            persistable = await client.init();

            // Before we do anything else, let's just check if we have a backup waiting - we
            // can then add these events to anything found today and send them all so nothing
            // gets missed
            const backups: Array<Backup> = await client.restore();
            if ( backups.length > 0 ) {
                retry = backups[backups.length - 1];
                for ( let b = 0; b < backups.length - 1; b++ ) {
                    retry.merge(backups[b]);
                    keys.push(backups[b].getKey());
                    Narrator.info('Backup ' + backups[b].getKey() + ' found');
                }
                keys.push(retry.getKey());
                Narrator.info('Backup ' + retry.getKey() + ' found');
                Narrator.info(keys.length + ' backups found');
                // If a backup exists for today then this has been fired purely as a retry
                // attempt, and we just resend that then quit
                if ( retry.isToday() ) {
                    Narrator.log('Retrying existing ICS file');
                    email.construct(retry.getEvents());
                    Narrator.log('Emailing ICS file');
                    const success: boolean = await email.sendEvents();
                    if ( success ) {
                        Narrator.log('Removing backup from database');
                        client!.reset(keys);
                    } else {
                        Narrator.error('Unable to send email');
                    }
                    return;
                }
            }

        } catch (e) {
            Narrator.error('Unexpected error initialising DB', e as Error);
            await email.sendError('Error trying to initialise DB - The email should still send but may contain details already sent.', e);
        }

        // Now loop through the fixtures, finding sales dates, comparing them to already persisted ones,
        // and email out any new ones.
        try {
            Narrator.heading('Downloading fixture list');
            const success: boolean = await fixtures.download();
            if ( !success ) {
                throw('Unable to retrieve fixtures');
            }
            Narrator.log('Parsing for fixtures');
            const count: number = fixtures.find();
            Narrator.info(count + ' fixtures found');
            if ( count > 0 ) {
                Narrator.log('Parsing individual fixtures');
                await fixtures.parseAll();

                if ( persistable ) {
                    Narrator.log('Syncing with database');
                    for ( const fixture of fixtures.getFixtures() ) {
                        await client!.sync(fixture);
                    }
                }

                let events: Array<ICS.EventAttributes> = new Array<ICS.EventAttributes>();
                if ( fixtures.hasChanged() ) {
                    Narrator.log('Generating ICS file');
                    events = fixtures.getChanges();
                    if ( persistable ) {
                        Narrator.log('Storing email contents in case of failure');
                        const backup: Backup = new Backup(new Date(), events);
                        client!.backup(backup);
                        keys.push(backup.getKey());
                    }
                }
                if ( retry != null ) {
                    events = events.concat(retry.getEvents());
                }
                if ( events.length > 0 ) {
                    Narrator.log('Emailing ICS file');
                    email.construct(events);
                    const success: boolean = await email.sendEvents(fixtures.getFixtures(true));
                    if ( success ) {
                        if ( persistable ) {
                            Narrator.log('Removing ' + keys.length + ' backup' + (keys.length > 1 ? 's' : '') + ' from database');
                            await client!.reset(keys);
                        }
                    } else {
                        Narrator.error('Unable to send email');
                    }
                } else {
                    Narrator.info('No changes since last email');
                }
            }
            Narrator.success('Ticket Parsing Complete');
        } catch (e) {
            Narrator.error('Unexpected error trying to parse and send email', e as Error);
            await email.sendError('Error trying to send LFC sales email', e);
        }
    }
}

const capture = ()  => {
    const log = console.log;
    const error = console.error;

    const buffer: Array<string> = [];
    const re = new RegExp(String.fromCodePoint(27) + '[[0-9;]*m', 'g');

    console.log = (...args: unknown[]) => {
        buffer.push(args.map(String).join(' ').replace(re, ''));
        log(...args);
    };

    console.error = (...args: unknown[]) => {
        buffer.push(args.map(String).join(' ').replace(re, ''));
        error(...args);
    };

    return {
        output(): string {
            return buffer.join('\n');
        },
        clear(): void {
            buffer.length = 0;
        },
        restore(): void {
            console.log = log;
            console.error = error;
        }
    };
}

dotenv.config({ debug: false, quiet: true });
const environment: string = (process.env.ENVIRONMENT || Constants.ENV_DEV) as string;
const debug: boolean = process.env.DEBUG === 'true';

const logger = capture();
const isLambda: boolean = !!process.env.LAMBDA_TASK_ROOT;

export const handler = async (): Promise<void> => {
    Narrator.title('Running LFC Ticket Parser on AWS Lambda');

    Narrator.heading('Retrieving SSM secrets');
    const client = new SSMClient({});
    let nextToken: string | undefined;
    do {
        const res = await client.send(
            new GetParametersByPathCommand({
                Path: '/lfct/' + environment.toLowerCase(),
                Recursive: false,
                WithDecryption: true,
                NextToken: nextToken,
            })
        );
        for (const p of res.Parameters ?? []) {
            const key = p.Name!.split('/').pop()!;
            if (!(key in process.env)) {
                process.env[key] = p.Value!;
            }
        }
        nextToken = res.NextToken;
    } while (nextToken);

    await TicketParser.parse(environment);
    const email:Email = new Email();
    if (debug) {
        await email.sendLog(logger.output());
    }
};    

if (!isLambda) {
    Narrator.title('Running LFC Ticket Parser locally');
    TicketParser.parse(environment).then(() => {
        const email:Email = new Email();
        if (debug) {
            email.sendLog(logger.output());
        }
    });
}
