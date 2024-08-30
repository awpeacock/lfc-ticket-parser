import dotenv from 'dotenv';
import * as ICS from 'ics'

import Fixture from './fixture';

/**
 * Class representing the information contained within the "Tickets Availability page",
 * and functions to download and parse it.
 */
export default class FixtureList {

    /** The HTML downloaded from the LFC Tickets Availability URL. */
    private html: string = '';

    /** An array to hold all the fixtures found when the HTML has been parsed. */
    private fixtures: Array<Fixture> = [];

    /**
     * Downloads the HTML file from the Liverpool FC website, using the URL provided
     * in the .env file.  This should not throw any errors but, rather, will handle any 
     * errors and just return false.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
    */
    async download(): Promise<boolean> {

        dotenv.config();
        if ( !process.env.DOMAIN || !process.env.INDEX_URL ) {
            return false;
        }
        const url: Undefinable<string> = process.env.DOMAIN + process.env.INDEX_URL;
        if ( !url ) {
            return false;
        }
        try {
            this.html = await fetch(url).then(res => res.text());
        } catch (e) {
            console.error(e);
            return false;
        }
        return (this.html.length > 0);

    }

    /**
     * Parses the HTML file previously downloaded, and constructs Fixture objects from the key information contained within.
     * @return {number} The total number of fixtures found.
     * @throws Will throw an error if the HTML is unable to be parsed.
     */
    find(): number {

        if ( this.html == null || this.html == '' ) {
            throw 'HTML for the "Tickets Availability" index page is empty';
        }
        // Every fixture on the page is contained within an A tag with the following class name - loop through all of these
        // to get the pertinent information that will help us to parse them all for selling arrangements
        const re: RegExp = /<a class="ticket-card fixture" href="(.+?)">(.+?)<\/a>/gis;
        let match : Nullable<RegExpExecArray>;
        while ( (match = re.exec(this.html)) !== null ) {

            const url: string = match[1], section: string = match[2];

            // The "info" block contains all the information about opposition and kick-off
            const info: Nullable<RegExpMatchArray> = section.match(/<div class="info">.*<p>(.+?) v (.+?)<\/p>.*<span>(.+?),.?(\d{1,2}):(\d{2})([ap]m)<\/span>/s);
            if ( info == null || info.length != 7 ) {
                throw 'Invalid HTML format';
            }
            const home: string = info[1];
            const away: string = info[2];
            const opposition: string = (home == 'Liverpool FC' ? away : home);

            // Unfortunately, the kick-off date/time is formatted in such a way that Javascript will throw "Invalid Date" 
            // if you try and convert directly, so a bit of interpretation is required (it's the 3:00pm that it doesn't like)
            const ko: Date = new Date(info[3]);
            const hours: number = parseInt(info[4]) + (info[6] == 'pm' ? 12: 0), minutes: number = parseInt(info[5]);
            ko.setHours(hours);
            ko.setMinutes(minutes);

            // The remaining details (home/away and competition) helpfully have their own class identifiers
            const l: Nullable<RegExpMatchArray> = section.match(/<span class="match-location">([HA])<\/span>/);
            const venue: Venue = (l != null ? l[1] as 'H'|'A' : 'U');
            const c: Nullable<RegExpMatchArray> = section.match(/<span class="comp-text">(.+?)<\/span>/);
            const competition: string = (c != null ? c[1] : 'Unknown');

            // Now create the Fixture object and add it to the array for looping through later and individually parsing
            const fixture: Fixture = new Fixture(url, opposition, venue, competition, ko);
            this.fixtures.push(fixture);

        }
        return this.fixtures.length;

    }

    /**
     * Returns all fixtures belonging to the fixture list.
     * @return {Array<Fixture>} An array of Fixture objects previously found.
     */
    getFixtures(): Array<Fixture> {
        return this.fixtures;
    }

    /**
     * Loops through each fixture previously found, and parses them in turn to find all relevant upcoming sales details.
     * @return {boolean} A boolean indicating the success, or otherwise, of the operation.
     */
    async parseAll(): Promise<boolean> {
        let success: boolean = true;
        for ( const fixture of this.fixtures ) {
            const downloaded: boolean = await fixture.download();
            if ( !downloaded ) {
                success = false;
            }
            try {
                fixture.find();
            } catch (e) {
                console.error(e);
                success = false;
            }
        }
        return success;
    }

    /**
     * Indicates whether any fixtures contained within this fixture list have changed since this was last run.
     * @return {boolean} Whether the sales dates for any fixtures have changed.
     */
    hasChanged(): boolean {
        let changed: boolean = false;
        for ( const fixture of this.fixtures ) {
            if ( fixture.hasChanged() && fixture.getActiveSaleCount() > 0 ) {
                changed = true;
            }
        }
        return changed;
    }

    /**
     * Returns an ICS string representating any valid sales/registrations associated with all fixtures found.
     * @return {string} A string in ICS format for all sales/registrations..
     * @throws Will throw an error if it is unable to create the ICS string.
     */
    getCalendarEvents(): string {

        let events: Array<ICS.EventAttributes> = [];
        this.fixtures.forEach((fixture) => {
            if ( fixture.getActiveSaleCount() > 0 && fixture.hasChanged() ) {
                events = events.concat(fixture.getCalendarEvents());
            }
        });

        // Before we create the calendar file, we should loop through all the events and find any
        // that occur on the same day (i.e. bulk sales) - we don't want to create multiple calendar
        // entries for these, just one
        const duplicates: Array<number> = [];
        for ( let e1 = 0; e1 < (events.length - 1); e1++ ) {
            for ( let e2 = (e1 + 1); e2 < events.length; e2++ ) {
                if ( events[e1].start.toString() == events[e2].start.toString() ) {
                    // Manipulating the array now could cause issues while we're looping through it,
                    // so add the index to an array to be removed later and update the original

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
        return response.value!;

    }

}