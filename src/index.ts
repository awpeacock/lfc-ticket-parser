import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Attachment } from 'nodemailer/lib/mailer';
import SMTPTransport, { MailOptions } from 'nodemailer/lib/smtp-transport';

import { FixtureList } from "./fixtures";

class TicketParser {

    static async parse() {
        const fixtures: FixtureList = new FixtureList();
        try {
            const success: boolean = await fixtures.download();
            if ( !success ) {
                throw('Unable to retrieve fixtures');
            }
            const count: number = fixtures.find();
            if ( count > 0 ) {
                const parsed: boolean = await fixtures.parseAll();
                if ( !parsed ) {
                    throw('Unable to parse fixtures');
                }
                const ics: string = fixtures.getCalendarEvents();
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
            }
        } catch (e) {
            console.error(e);
            TicketParser.email('Error trying to send LFC sales email', 'The following error occurred:\r\n' + e);
        }
    }

    static async email(subject: string, body: string, attachment?: Attachment): Promise<boolean> {

        try {

            dotenv.config();
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

TicketParser.parse();