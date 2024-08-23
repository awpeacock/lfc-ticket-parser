import dotenv from 'dotenv';

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
            throw 'HTML is empty';
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

}