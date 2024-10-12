import nodemailer from 'nodemailer';
import { Attachment } from 'nodemailer/lib/mailer';
import SMTPTransport, { MailOptions } from 'nodemailer/lib/smtp-transport';
import * as ICS from 'ics'

/**
 * Class representing the information that will make up the email sent out
 * by the parser, and functions to send it (or send error emails).
 */
export default class Email {

    /** The ICS object that contains all the information about sales dates. */
    private ics: Undefinable<ICS.ReturnObject>;

    /** The "friendly" name of the tables on which to write fixture and backup details. */
    static FROM_NAME: string = 'LFC Ticket Sales Parse';

    /** The subject line that will appear as the prefix on all emails. */
    static SUBJECT_SALES: string = 'Latest LFC ticket sales dates';
    /** The subject line that will appear on all error emails. */
    static SUBJECT_ERROR: string = 'LFC Ticket Parser ERROR';

    /** The content that will make up the email body for the sales dates emails. */
    static BODY_SALES: string = 'Please find attached the latest sales dates for LFC fixtures.  Load the file using your preferred calendar software.';

    /**
     * Populates the object with all the events relevant to that particular email, that will
     * be emailed as an attachment.
     * @param {Array<ICS.EventAttributes>} events - All sales dates that will be contained in the ICS attachment.
     */
    construct(events: Array<ICS.EventAttributes>) {

        // Before we create the calendar file, we should loop through all the events and find any
        // that occur on the same day (i.e. bulk sales) - we don't want to create multiple calendar
        // entries for these, just one
        const duplicates: Array<number> = [];
        for ( let e1 = 0; e1 < (events.length - 1); e1++ ) {
            for ( let e2 = (e1 + 1); e2 < events.length; e2++ ) {
                if ( events[e1].start.toString() == events[e2].start.toString() ) {
                    // Manipulating the array now could cause issues while we're looping through it,
                    // so add the index to an array to be removed later and update the original

                    // Before we do anything fancy, check it isn't the same sale for the same
                    // fixture (might come through from a backed up email attempt)
                    if ( JSON.stringify(events[e1]) == JSON.stringify(events[e2]) ) {
                        duplicates.push(e2);
                        continue;
                    }

                    // First, setup two regular expressions - one for all the titles as they currently are,
                    // and one to match the title of the first event as it will be once it's been replaced
                    const original: RegExp = /^(.+?)\s\(H\)(.+)$/, replaced: RegExp = /^Bulk Sale \((.+?)\)(.+)$/;
                    // Then, use the original regex to get the name of the opposition for the second event on the same date
                    const match: Nullable<RegExpMatchArray> = events[e2].title!.match(original);
                    const opposition: string = match![1];
                    // Now, work out which regex to use for our first event depending upon if it's already been
                    // manipulated, and tweak it to be a bulk sale with the names of all the games included
                    if ( !events[e1].title!.startsWith('Bulk Sale') ) {
                        events[e1].title = events[e1].title!.replace(original, 'Bulk Sale ($1, ' + opposition + ')$2');
                    } else {
                        events[e1].title = events[e1].title!.replace(replaced, 'Bulk Sale ($1, ' + opposition + ')$2');
                    }

                    // Finally, add the index for the second occurrence to the array to be removed after all have
                    // been looped through
                    duplicates.push(e2);
                }
            }
        }
        // Now, loop through the array of dupes and remove them from the array (backwards, so the indexes are kept in tact)
        for ( let d = duplicates.length - 1; d >= 0; d-- ) {
            events.splice(duplicates[d], 1);
        }

        const response: ICS.ReturnObject = ICS.createEvents(events);
        if ( response.error ) {
            throw(response.error);
        }
        this.ics = response;

    }

    /**
     * Sends the sales dates email. 
     * @return {Promise<boolean>} Indicator of the success, or otherwise, of the attempt.
     * @throws Will throw an error if anything fails while attempting to send the email.
     */
    async sendEvents(): Promise<boolean> {

        const date: string = new Date().getDate() + '/' + (new Date().getMonth()+1) + '/' + new Date().getFullYear();
        const subject: string = Email.SUBJECT_SALES + ' (' + date + ')';
        const body: string = Email.BODY_SALES;
        const attachment: Attachment = {
            filename: 'lfcinfo.ics',
            content: this.ics!.value
        };
        return this.send(subject, body, attachment);

    }

    /**
     * Sends an error email. 
     * @param {string} message - An accompanying message to go with the error detail.
     * @param {any} e - (Usually an Error object) - precise details of the error that occurred.
     * @return {Promise<boolean>} Indicator of the success, or otherwise, of the attempt.
     * @throws Will throw an error if anything fails while attempting to send the email.
     */
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    async sendError(message: string, e: any): Promise<boolean> {

        return this.send(Email.SUBJECT_ERROR, message + '\r\nThe following went wrong:\r\n' + e);

    }

    /**
     * The method that actually executes the sending of an email, regardless of type or content. 
     * @param {string} subject - The email's subject line.
     * @param {string} body - The main content of the email
     * @param {Attachment} attachment - (Optional) Any attachment to be sent with the email.
     * @return {Promise<boolean>} Indicator of the success, or otherwise, of the attempt.
     * @throws Will throw an error if anything fails while attempting to send the email.
     */
    private async send(subject: string, body: string, attachment?: Attachment): Promise<boolean> {

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
                from: Email.FROM_NAME + '<' + process.env.EMAIL_FROM + '>',
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