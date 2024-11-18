import dotenv from 'dotenv';
import * as ICS from 'ics'

import { FixtureList } from "./fixtures";
import { PersistenceFactory, Client, Backup } from './persistence';
import { Email } from './distribution';

class TicketParser {

    static async parse(): Promise<void> {

        dotenv.config();
        const email:Email = new Email();
        const fixtures: FixtureList = new FixtureList();

        // Initialise the DB in a separate try/catch loop - if an unexpected error
        // occurs we don't want it to impact sending the email
        let client: Client, persistable: boolean = false, retry: Nullable<Backup> = null;
        const keys: Array<string> = new Array<string>();
        try {
            const db: Database = process.env.DB_CLIENT as Database;
            const table: string = process.env.DB_TABLE as string;
            const backup: string = process.env.DB_BACKUP as string;
            if ( db == null || table == null || backup == null ) {
                throw new Error('No database variables set');
            }
            console.log('+ Initialising "' + db + '" database');
            client = PersistenceFactory.getClient(db, table, backup);
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
                    console.log('+ Backup ' + backups[b].getKey() + ' found');
                }
                keys.push(retry.getKey());
                console.log('+ Backup ' + retry.getKey() + ' found');
                console.log('+ ' + keys.length + ' backups found');
                // If a backup exists for today then this has been fired purely as a retry
                // attempt, and we just resend that then quit
                if ( retry.isToday() ) {
                    console.log('+ Retrying existing ICS file');
                    email.construct(retry.getEvents());
                    console.log('+ Emailing ICS file');
                    const success: boolean = await email.sendEvents();
                    if ( success ) {
                        console.log('+ Removing backup from database');
                        client!.reset(keys);
                    } else {
                        console.error('Unable to send email');
                    }
                    return;
                }
            }

        } catch (e) {
            console.error(e);
            email.sendError('Error trying to initialise DB - The email should still send but may contain details already sent.', e);
        }

        // Now loop through the fixtures, finding sales dates, comparing them to already persisted ones,
        // and email out any new ones.
        try {
            console.log('+ Downloading fixture list');
            const success: boolean = await fixtures.download();
            if ( !success ) {
                throw('Unable to retrieve fixtures');
            }
            console.log('+ Parsing for fixtures');
            const count: number = fixtures.find();
            console.log('+ ' + count + ' fixtures found');
            if ( count > 0 ) {
                console.log('+ Parsing individual fixtures');
                const parsed: boolean = await fixtures.parseAll();
                if ( !parsed ) {
                    throw('Unable to parse fixtures');
                }

                if ( persistable ) {
                    console.log('+ Syncing with database');
                    for ( const fixture of fixtures.getFixtures() ) {
                        await client!.sync(fixture);
                    }
                }

                let events: Array<ICS.EventAttributes> = new Array<ICS.EventAttributes>();
                if ( fixtures.hasChanged() ) {
                    console.log('+ Generating ICS file');
                    events = fixtures.getChanges();
                    if ( persistable ) {
                        console.log('+ Storing email contents in case of failure');
                        const backup: Backup = new Backup(new Date(), events);
                        client!.backup(backup);
                        keys.push(backup.getKey());
                    }
                }
                if ( retry != null ) {
                    events = events.concat(retry.getEvents());
                }
                if ( events.length > 0 ) {
                    console.log('+ Emailing ICS file');
                    email.construct(events);
                    const success: boolean = await email.sendEvents(fixtures.getFixtures(true));
                    if ( success ) {
                        if ( persistable ) {
                            console.log('+ Removing ' + keys.length + ' backup' + (keys.length > 1 ? 's' : '') + ' from database');
                            await client!.reset(keys);
                        }
                    } else {
                        console.error('Unable to send email');
                    }
                } else {
                    console.log('+ No changes since last email');
                }
            }
            console.log('+ Ticket Parsing Complete');
            console.log('----------------------------------------');
        } catch (e) {
            console.error(e);
            email.sendError('Error trying to send LFC sales email', e);
        }
    }

}

const isLambda: boolean = !!process.env.LAMBDA_TASK_ROOT;
if ( isLambda ) {
    module.exports.handler = async () => {
        console.log('----------------------------------------');
        console.log('Running LFC Ticket Parser on AWS Lambda');
        console.log('----------------------------------------');
        await TicketParser.parse();
    };    
} else {
    console.log('----------------------------------------');
    console.log('Running LFC Ticket Parser locally');
    console.log('----------------------------------------');
    TicketParser.parse();
}