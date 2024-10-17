import dotenv from 'dotenv';
import { EventAttributes } from 'ics';

import Sale from "./sale";

/**
 * Class representing each upcoming fixture with the relevant information,
 * and functions to retrieve this data and parse it.
 */
export default class Fixture {

    /** A unique identifier for each fixture (generated internally at construction), used to detect changes. */
    readonly id: string;
    /** The URL of the page containing sales dates. */
    private url: string;
    /** The season in which the match is occurring. */
    private season: number;
    /** The name of the opposition for the fixture. */
    private opposition: string;
    /** Whether the fixture is home (H), away (A), neutral (N), or maybe unknown (U). */
    private venue: Venue;
    /** The competition in which the fixture is being played (e.g. Premier League, FA Cup). */
    private competition: string;
    /** The date the fixture is to be played. */
    private ko: Date;

    /** The HTML downloaded from the fixture's individual selling details page. */
    private html: string = '';

    /** An array of sale dates for the fixture (including ended sales and sales that aren't relevant). */
    private sales: Array<Sale> = [];

    /** A boolean representing whether this fixture has changed since the parser was last run - set to true by default, 
     * so all fixtures will be emailed in case of any issues with connecting with the persistence layer. */
    private changed: boolean = true;

    /**
     * Creates a Fixture from the parameters provided.
     * @param {string} url - The URL of the page containing sales dates.
     * @param {string} opposition - The name of the opposition for the fixture.
     * @param {Venue} venue - Whether the fixture is home (H), away (A), neutral (N), or maybe unknown (U).
     * @param {string} competition - The competition in which the fixture is being played (e.g. Premier League, FA Cup).
     * @param {Date} ko - The date the fixture is to be played.
     */
    constructor(url: string, opposition: string, venue: Venue, competition: string, ko: Date) {

        // Calculate the first year of the current season (e.g. 2024-25 is 2024) for the unique identifier
        this.season = ko.getFullYear() - (ko.getMonth() < 5 ? 1 : 0);
        // Now onstruct the ID for the fixture from the combo of season, opposition, home/away and competition - 
        // these should always be a unique combination (and also prevent a "new" fixture being created every time 
        // the date/time of kick off changes)
        this.id = (this.season+'-'+opposition+'-'+venue+'-'+competition).toLowerCase().replace(/&amp; /g,'').replace(/ /g, '-');
        this.url = url;
        this.opposition = opposition;
        this.venue = venue;
        this.competition = competition;
        this.ko = ko;

    }

    /**
     * Downloads the HTML file from the Liverpool FC website, using the URL provided
     * in the constructor.  This should not throw any errors but, rather, will handle any 
     * errors and just return false.
     * @return {Promise<boolean>} A boolean indicating the success, or otherwise, of the operation.
    */
    async download(): Promise<boolean> {

        dotenv.config();
        if ( !process.env.DOMAIN ) {
            return false;
        }
        try {
            this.html = await fetch(process.env.DOMAIN + this.url).then(res => res.text());
        } catch (e) {
            console.error(e);
            return false;
        }
        return (this.html.length > 0);

    }

    /**
     * Parses the HTML file previously downloaded, and constructs Sale objects from the key information contained within.
     * @return {number} The total number of sale details found.
     * @throws Will throw an error if the HTML is unable to be parsed.
     */
    find(): number {

        if ( this.html == null || this.html == '' ) {
            throw new Error('HTML for "' + this.getMatch() + '" is empty');
        }
        // First off, a quick sanity check we've got the right fixture
        const pattern: RegExp = new RegExp('<title>' + (this.venue == 'A' ? this.opposition.replace('&amp; ', '') + ' V Liverpool Fc' : 'Liverpool Fc V ' + this.opposition.replace('&amp; ', '')) + '.*?</title>', 'i'); 
        const title: Nullable<RegExpMatchArray> = this.html.match(pattern);
        if ( title == null ) {
            throw new Error('Parsing the wrong fixture - expecting "' + this.opposition + '"');
        }
            
        // Now, find each element representing a sale date, registration date, etc.
        const re: RegExp = /<h3>.*?<span class="salename">(.+?)<\/span>.*?(?:<span class="prereqs">(.*?)<\/span>).*?<span class="status">(.+?)<\/span>\s*?(?:(?:<span class="whenavailable">(.+?)(\d{1,2}):(\d{2})([ap]m)<\/span>).*?)?<\/h3>.*?(?:(?:Buy.*?from (\d{1,2})(?:[:.](\d{2}))?([ap]m).*?([A-Z].*?)\.<).*?)?<\/li>/gs;
        let match : Nullable<RegExpExecArray>;
        while ( (match = re.exec(this.html)) !== null ) {

            // Any tier one fixtures or away games will have pre-requisites (how many credits recorded) for the sale.
            // Make sure to capture this and include in the description to make the information useful.
            // Of course, just to be awkward, some times they use numbers, some times they use the words!
            let credits: number = 0;
            const prereqs: Nullable<RegExpMatchArray> = match[2].match(/recorded (all )*(.+?)((\+)|( or more)|( of))/);
            if ( prereqs != null ) {
                if ( !prereqs[2].match(/^d+$/) ) {
                    // Max credits we can ever need must surely be 19 (every home or away game in a league season)
                    const words: Array<string> = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
                    for ( let w = 0; w < 19; w++ ) {
                        prereqs[2] = prereqs[2].replace(words[w], String(w+1));
                    }
                }
                credits = parseInt(prereqs[2]);
            }

            const description: string = match[1].replace(/SEASON TICKET HOLDERS/i, 'ST Holders').replace(/OFFICIAL MEMBERS/i, 'Members').replace(/REGISTRATION/i, 'Registration').replace(/AND/i, 'and') + ((!match[1].toLowerCase().endsWith('sale') && !match[1].toLowerCase().endsWith('registration')) ? ' Sale' : '') + (credits > 0 ? ' (' + credits + '+)' : '');
            const status: Status = (
                (match[3].toLowerCase().indexOf('ended') > -1 || match[3].toLowerCase().indexOf('sold out') > -1) ? Status.ENDED : (
                (match[3].toLowerCase().indexOf('available') > -1 || match[3].toLowerCase().indexOf('buy now') > -1) ? Status.AVAILABLE : 
                Status.PENDING
            ));

            // As with the fixture date, the sale date/time is formatted in such a way that Javascript will throw "Invalid Date" 
            // if you try and convert directly, so a bit of interpretation is required
            let date: Nullable<Date> = null;
            if ( match[4] ) {
                date = new Date(match[4]);
                const hours: number = parseInt(match[5]) + (match[7] == 'pm' ? 12: 0), minutes: number = parseInt(match[6]);
                date.setHours(hours);
                date.setMinutes(minutes);
            } else if ( match[8] ) {
                date = new Date(match[11] + (/\s\d{4}$/.test(match[11]) ? '' : ' ' + new Date().getFullYear()));
                const hours: number = parseInt(match[8]) + (match[10] == 'pm' ? 12: 0), minutes: number = (match[6] ? parseInt(match[6]) : 0);
                date.setHours(hours);
                date.setMinutes(minutes);
            }

            const sale: Sale = new Sale(description, status, date);
            this.sales.push(sale);

        }
        return this.sales.length;

    }

    /**
     * Returns a textual description of the fixture to be used in the calendar.
     * @return {string} The fixture's opposition, venue, competition and season.
     */
    getMatch(): string {
        return this.opposition + ' (' + this.venue + ') - ' + this.competition + ' (' + this.season + '-' + (this.season + 1).toString().substring(2) + ')';
    }

    /**
     * Returns a count of sales details that should be included in a calendar.
     * @return {number} The total number of sales/registrations that are pending (not including local sales, hospitality or ambulant seating).
     */
    getActiveSaleCount(): number {
        let count: number = 0;
        this.sales.forEach((sale) => {
            if ( sale.isValid() ) {
                count++;
            }
        });
        return count;
    }

    /**
     * Returns a Json representation of the fixture and all sales.
     * @return {Nullable<string>} The Json for this fixture if it has any valid sales, otherwise null.
     */
    getJson(): Nullable<string> {

        if ( this.getActiveSaleCount() == 0 ) {
            return null;
        }
        
        let json: string = '{"fixture":{"id":"' + this.id + '","match":"' + this.getMatch() + '","sales":[';
        this.sales.forEach((sale) => {
            if ( sale.isValid() ) {
                json += sale.getJson() + ',';
            }
        });
        json = json.substring(0, json.length - 1);
        json += ']}}';
        return json;
    }

    /**
     * Returns an array of ICS events representating any valid sales/registrations associated with the fixture.
     * @return {Array<EventAttributes>} An array of all attributes for all valid events.
     */
    getCalendarEvents(): Array<EventAttributes> {
        
        const events: Array<EventAttributes> = [];
        this.sales.forEach((sale) => {
            if ( sale.isValid() ) {
                // If the sale is valid, we know this will not be null, so we can safely force the type
                const event: EventAttributes = sale.getCalendarEvent() as EventAttributes;
                event.title = this.opposition.replace('&amp;', 'and') + ' (' + this.venue + ') : ' + event.title;
                events.push(event);
            }
        });
        return events;

    }

    /**
     * Compares the fixture's sales data with that contained within a JSON and returns whether
     * there is a difference between any active dates in either (note: it will not mark a
     * fixture as changed if either has an inactive sale that is not in the other as that is
     * irrelevant to the functionality of the parser).
     * @param {string} json - The JSON string produced by a Fixture's getJson method.
     * @return {boolean} An boolean indicating whether the two representations of a fixture are the same or not.
     */
    equals(json: string): boolean {

        const parsed: {fixture:{ id: string, sales: [{description: string, date: string}]}} = JSON.parse(json);
        const fixture: { id: string, sales: [{description: string, date: string}]} = parsed.fixture;
        const today: Date = new Date();

        // First, loop through this new version of the fixture - if there's anything in here that isn't in the DB then we want
        // to go off this new version.
        for ( let s1 = 0; s1 < this.sales.length; s1++ ) {
            // If the sale has ended/isn't valid then we don't care if it matches, move on to the next one
            if ( !this.sales[s1].isValid() ) {
                continue;
            }
            let found: boolean = false;
            for ( let s2 = 0; s2 < fixture.sales.length; s2++ ) {
                const sale: Sale = new Sale(fixture.sales[s2].description, Status.PENDING, new Date(fixture.sales[s2].date));
                if ( this.sales[s1].equals(sale) ) {
                    found = true;
                    break;
                }
            }
            // No point carrying on if the DB doesn't have this sales - 
            // the data for this fixture has changed and we need to reflect
            // what's on the site
            if ( !found ) {
                return false;
            }
        }
        
        // Next, loop through the sales on the DB - if the sales follow logic, then there should
        // be more here (if they're not all the same) as sales will disappear off the site as they finish
        for ( let s1 = 0; s1 < fixture.sales.length; s1++ ) {
            let found: boolean = false;
            for ( let s2 = 0; s2 < this.sales.length; s2++ ) {
                const sale: Sale = new Sale(fixture.sales[s1].description, Status.PENDING, new Date(fixture.sales[s1].date));
                if ( this.sales[s2].equals(sale) ) {
                    found = true;
                    break;
                }
            }
            // If we haven't found a match, check if it's because the date has passed - if it has,
            // that explains it and means we aren't looking at a change
            if ( !found ) {
                if ( today < new Date(fixture.sales[s1].date) ) {
                    return false;
                }
            }
        }
        
        return true;

    }

    /**
     * Sets whether the fixture has changed since this was last run.
     * @param {boolean} changed - Whether the sales dates for this fixture have changed.
     */
    setChanged(changed: boolean): void {
        this.changed = changed;
    }

    /**
     * Indicates whether the fixture has changed since this was last run.
     * @return {boolean} Whether the sales dates for this fixture have changed.
     */
    hasChanged(): boolean {
        return this.changed;
    }

}