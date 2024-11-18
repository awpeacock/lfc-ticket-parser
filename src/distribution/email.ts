import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Attachment } from 'nodemailer/lib/mailer';
import SMTPTransport, { MailOptions } from 'nodemailer/lib/smtp-transport';
import * as ICS from 'ics'

import { Fixture } from '../fixtures';

dotenv.config();

/**
 * Class representing the information that will make up the email sent out
 * by the parser, and functions to send it (or send error emails).
 */
export default class Email {

    /** An array of validated ICS events that make up the ICS object to be emailed. */
    private events: Array<ICS.EventAttributes> = [];

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
        // that occur on the same day (i.e. bulk sales or multiple registrations per credit) - we 
        // don't want to create multiple calendar entries for these, just one
        const unique: Array<ICS.EventAttributes> = Email.removeDuplicates(events);

        // Now that we're including the possibility of dates in the past (because of backups) make
        // sure all dates are in the future or ICS.createEvents will fall over
        const future: Array<ICS.EventAttributes> = [];
        for ( let e = 0; e < unique.length; e++ ) {
            const year: number = (unique[e].start as Array<number>).at(0)!,
                  month: number = (unique[e].start as Array<number>).at(1)! - 1,
                  day: number = (unique[e].start as Array<number>).at(2)!,
                  hour: number = (unique[e].start as Array<number>).at(3)!,
                  minute: number = (unique[e].start as Array<number>).at(4)!;
            const date: Date = new Date(year, month, day, hour, minute);
            const today: Date = new Date();
            if (date > today ) {
                future.push(unique[e]);
            }
        }
        this.events = future;
        
        const response: ICS.ReturnObject = ICS.createEvents(this.events);
        if ( response.error ) {
            throw(response.error);
        }
        this.ics = response;

    }

    /**
     * Sends the sales dates email. 
     * @param {Array<Fixture>} fixtures - An array of all fixtures currently present on the Tickets Availability page.
     * @return {Promise<boolean>} Indicator of the success, or otherwise, of the attempt.
     * @throws Will throw an error if anything fails while attempting to send the email.
     */
    async sendEvents(fixtures?: Array<Fixture>): Promise<boolean> {

        // Do not attempt to send an empty ICS file, will error when recipients try to do
        // anything with it (but return true - it hasn't failed so shouldn't flag as an
        // error anywhere)
        if ( this.events.length == 0 ) {
            return true;
        }

        const date: string = new Date().getDate() + '/' + (new Date().getMonth()+1) + '/' + new Date().getFullYear();
        const subject: string = Email.SUBJECT_SALES + ' (' + date + ')';
        let text: string = Email.BODY_SALES, html: string = '<p>' + Email.BODY_SALES + '</p>';
        const attachment: Attachment = {
            filename: 'lfcinfo.ics',
            content: this.ics!.value
        };

        // Now add some plain text for all upcoming events (regardless if included in the ICS attachment)
        if ( fixtures && fixtures.length > 0 ) {

            const addContent = (str: string, tag: string, bold: boolean) => {
                text += (tag != 'li' ? '\n\n' : '\n * ') + str;
                html += '<' + tag + '>' + (bold ? '<strong>' : '') + str + (bold? '</strong>' : '') + '</' + tag + '>';
            }
            addContent('All upcoming sales:', 'p', false);
            fixtures.forEach((fixture) => {
                if ( fixture.getActiveSaleCount() > 0 ) {
                    addContent(fixture.getMatch(),  'p', true);
                    html += '<ul>';
                    fixture.getSales().forEach((sale) => {
                        if ( sale.isValid() ) {
                            addContent(sale.getTitle() as string, 'li', false);
                        }
                    });
                    html += '</ul>';
                }
            });

        }
        return this.send(process.env.EMAIL_TO, subject, text, attachment, html);

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

        let to: Undefinable<string> = process.env.EMAIL_ERROR;
        if ( to == undefined ) {
            to = process.env.EMAIL_TO;
        }
        return this.send(to, Email.SUBJECT_ERROR, message + '\r\nThe following went wrong:\r\n' + e);

    }

    /**
     * The method that actually executes the sending of an email, regardless of type or content.
     * @param {Undefinale<string>} to - The email address(es) of the recipient. 
     * @param {string} subject - The email's subject line.
     * @param {string} body - The main content of the email.
     * @param {Attachment} attachment - (Optional) Any attachment to be sent with the email.
     * @param {string} html - (Optional) HTML version of the main body content.
     * @return {Promise<boolean>} Indicator of the success, or otherwise, of the attempt.
     * @throws Will throw an error if anything fails while attempting to send the email.
     */
    private async send(to: Undefinable<string>, subject: string, body: string, attachment?: Attachment, html?: string): Promise<boolean> {

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
                to: to,
                subject: subject,
                text: body
            };
            if ( attachment ) {
                mailOptions.attachments = [attachment];
            }
            if ( html ) {
                mailOptions.html = html;
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

    /**
     * Takes an array of events, finds any that occur at the same time (e.g. bulk sales and registrations)
     * and reduces them to one event. 
     * @param {Array<ICS.EventAttributes>} events - The array of sales dates to be parsed.
     * @return {Array<ICS.EventAttributes>} The parsed array with duplicates concatenated.
     */
    private static removeDuplicates(events: Array<ICS.EventAttributes>): Array<ICS.EventAttributes> {

        // No point doing anything with an empty array - for starters, it'll just throw an error
        // instantly
        if ( events.length == 0 ) {
            return events;
        }

        let log: string = 'Removing duplicates - ' + events.length + ' entries currently\n';
        
        // Create a new array to contain all unique events, so that we don't manipulate the
        // original array while working our way through it - we can safely start thus array
        // with the first event.
        const cleansed: Array<ICS.EventAttributes> = [events[0]];
        log += '+ "' + cleansed[0].title + '" added to cleansed array\n';

        for ( let e = 1; e < events.length; e++ ) {

            // Start off with the assumption that each event is unique, and will be added to
            // the array at the end unless proved otherwise.
            let unique: boolean = true;

            // And now loop through all the events already safely added to the cleansed array
            // to check this event against for uniqueness
            for ( let u = 0; u < cleansed.length; u++ ) {

                log += '+ Testing "' + events[e].title + '" against "' + cleansed[u].title + '"\n';
                // Before we do anything fancy, check it isn't the same sale for the same
                // fixture (might come through from a backed up email attempt) - no point
                // carrying on if so
                if ( JSON.stringify(events[e]) == JSON.stringify(cleansed[u]) ) {
                    unique = false;
                    log += '   - Identical sale\n';
                    break;
                }

                // Potential for a lot of repeated code here - we need a data object for key data from 
                // the untouched event string, and a search/replace pairing to come out of these
                // checks (to convert the title of the original "cleansed" event)
                type KeyEventData = {
                    opposition: string,
                    criteria: string
                }
                type SearchReplace = {
                    search: RegExp,
                    replace: string
                };

                // First bit of consistent code is that to get the opposition and criteria for the current event
                const extractOpposition = (title: string): KeyEventData => {
                    // Setup a regular expression to catch the new title as it currently is
                    const search: RegExp = /^(.+?)\s\(H\)\s:\s(.+?)(\((.*?)\))?$/;
                    // Then, use it to get the name of the opposition for the event being tested
                    const match: Nullable<RegExpMatchArray> = title!.match(search);
                    const opposition: string = match![1], criteria: string = match![4];
                    return {
                        opposition: opposition,
                        criteria: criteria
                    };
                }

                // Then, we need a method to merge registration...
                const tidyRegistration = (original: ICS.EventAttributes, current: ICS.EventAttributes): SearchReplace => {
                    let search: RegExp;
                    let replace: string;

                    const data: KeyEventData = extractOpposition(current.title!);

                    // Bulk sales are always on separate date/times depending on credits, but registrations are all
                    // at the same time so we need to pick out the different criteria and compare
                    search = /^(.+?)\s\(H\)\s:\s([^0-9]+)((\d{1,2}\+)?)(.*?)Registration(?:\s\()?(\d{1,2}\+)?.*?$/;
                    const match: Nullable<RegExpMatchArray> = current.title!.match(search);
                    // If no criteria is in the string then it must be a general sale
                    let criteria: string = 'General';
                    // According to the type of sale, the criteria can be in different groups (and mark
                    // the group index for RegEx callback later)
                    let index = 3;
                    if ( match != null ) {
                        if ( match[3] ) {
                            criteria = match[3];
                        } else if ( match[6] ) {
                            index = 6;
                            criteria = match[6];
                        }
                    }
                    // If it is the same credits criteria as before then we don't need to add
                    if ( original.title!.includes(criteria) ) {
                        criteria = '';
                    } else {
                        criteria = ', ' + criteria;
                    }

                    // Now we have everything we need to create the SearchReplace pair - there will
                    // need to be different values for each depending on if this is the first 
                    // amendment to the original
                    if ( original.title!.startsWith('Registration') ) {
                        search = /^Registration \((.+?)\)\s:\s(.*?)\((.*?)\)$/;
                        if ( original.title!.includes(data.opposition) ) {
                            replace = 'Registration ($1) : $2($3' + criteria + ')';
                        } else {
                            replace = 'Registration ($1, ' + data.opposition + ') : $2($3' + criteria + ')';
                        }  
                    } else {
                        if ( original.title!.includes(data.opposition) ) {
                            replace = 'Registration ($1) : $2$5($' + index + criteria + ')';
                        } else {
                            replace = 'Registration ($1, ' + data.opposition + ') : $2$5($' + index + criteria + ')';
                        } 
                    }                  
                    return {
                        search: search,
                        replace: replace
                    };
                }

                // ... and a method to merge sales
                const tidySale = (original: ICS.EventAttributes, current: ICS.EventAttributes): SearchReplace => {
                    const data: KeyEventData = extractOpposition(current.title!);
                    let criteria: string = 'General';
                    if ( data.criteria ) {
                        criteria = data.criteria;
                    }
                    if ( original.title!.includes(criteria) ) {
                        criteria = '';
                    } else {
                        criteria = ', ' + criteria;
                    }
                    
                    if ( original.title!.startsWith('Bulk Sale') ) {
                        return {
                            search: /^Bulk Sale \((.+?)\)\s:\s(.*?)\((.+?)\)$/,
                            replace: 'Bulk Sale ($1, ' + data.opposition + ') : $2($3' + criteria + ')'
                        };
                    } else {
                        return {
                            search:  /^(.+?)\s\(H\)\s:\s(.+?)(\((.*?)\))?$/,
                            replace: 'Bulk Sale ($1, ' + data.opposition + ') : $2($4' + criteria + ')'
                        };
                    }
                }

                // If we have an event with the same date and time then we know we don't have a
                // unique entry, but before we bail out we need to amend the original event to
                // include the details of this one
                if ( events[e].start.toString() == cleansed[u].start.toString() ) {
                    log += '   - Sale occurs at same date/time\n';
                    
                    // Now, work out which regex to use for our first event, and tweak it to be a 
                    // amalgamated event with the names of all the games included
                    let sr: SearchReplace;
                    if ( cleansed[u].title!.includes('Registration') ) {
                        sr = tidyRegistration(cleansed[u], events[e]);
                    } else {
                        sr = tidySale(cleansed[u], events[e]);
                    }
                    cleansed[u].title = cleansed[u].title!.replace(sr.search, sr.replace);
                    cleansed[u].title = cleansed[u].title!.replace(/\s{2,}/, ' ');
                    log += '   - Cleansed entry re-titled to "' + cleansed[u].title + '"\n';                  
                    unique = false;
                    break;
                }
            }

            // If we've gone through all the existing games without any matches, then we can
            // happily add this event to the cleansed array
            if ( unique ) {
                log += '   - Sale "' + events[e].title + '" is unique\n';                  
                cleansed.push(events[e]);
            }
        }

        log += cleansed.length + ' entries now in array';
        if ( process.env.DEBUG ) {
            console.debug(log);
        }
        return cleansed;

    }

}