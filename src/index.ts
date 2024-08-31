import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Attachment } from 'nodemailer/lib/mailer';
import SMTPTransport, { MailOptions } from 'nodemailer/lib/smtp-transport';

import { FixtureList } from "./fixtures";
import { PersistenceFactory, Client } from './persistence';

class TicketParser {

    static async parse() {

        dotenv.config();
        const fixtures: FixtureList = new FixtureList();

        // Initialise the DB in a separate try/catch loop - if an unexpected error
        // occurs we don't want it to impact sending the email
        let client: Client, persistable: boolean = false;
        try {
            const db: Database = process.env.DB_CLIENT as Database;
            const table: string = process.env.DB_TABLE as string;
            console.log('+ Initialising "' + db + '" database');
            client = PersistenceFactory.getClient(db, table);
            persistable = await client.init();
        } catch (e) {
            console.error(e);
            TicketParser.email('Error trying to initialise DB', 'The following error occurred:\r\n' + e + '\r\nThe email should still send but may contain details already sent.');
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

                if ( fixtures.hasChanged() ) {
                    console.log('+ Generating ICS file');
                    const ics: string = fixtures.getCalendarEvents();
                    console.log('+ Emailing ICS file');
                    const date: string = new Date().getDate() + '/' + (new Date().getMonth()+1) + '/' + new Date().getFullYear();
                    const attachment: Attachment = {
                        filename: 'lfcinfo.ics',
                        content: ics
                    };
                    const success: boolean = await TicketParser.email(
                        'Latest LFC ticket dates (' + date + ')', 
                        'Please find attached the latest sales dates for LFC fixtures.  Load the file using your preferred calendar software.',
                        attachment
                    );
                    if ( !success ) {
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
            TicketParser.email('Error trying to send LFC sales email', 'The following error occurred:\r\n' + e);
        }
    }

    static async email(subject: string, body: string, attachment?: Attachment): Promise<boolean> {

        try {

            // If we've not managed to get the email config, no point continuing - this is dead
            if ( !process.env.EMAIL_HOST ) {
                return false;
            }

            const smtpOptions: SMTPTransport.Options = {
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT as string),
                secure: process.env.EMAIL_SECURE === 'true', 
                auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
                }
            };
            const mailOptions: MailOptions = {
                from: process.env.EMAIL_FROM,
                to: process.env.EMAIL_TO,
                subject: subject,
                text: body
            };
            if ( attachment ) {
                mailOptions.attachments = [attachment];
            }

            const transporter: nodemailer.Transporter = nodemailer.createTransport(smtpOptions);
            const info: SMTPTransport.SentMessageInfo = await transporter.sendMail(mailOptions);
            if ( info.response.includes('250 OK') ) {
                return true;
            } else {
                console.error('Response from mail server: ', info.response);
                return false;
            }

        } catch (e) {

            // We don't want to throw any errors in here, as we could get ourselves in trouble trying
            // to email ourselves about any errors faced sending emails!
            console.error(e);
            return false;

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