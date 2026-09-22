import dotenv from 'dotenv';
import * as ICS from 'ics'

import { Narrator } from '@redpenguinstudio/herbert';

import { GetFormat } from '../constants';

import Fixture from './fixture';

/**
 * Class representing the information contained within the "Tickets Availability page",
 * and functions to download and parse it.
 */
export default class FixtureList {

    /** The HTML format to be used to parse the fixtures */
    private format: number = GetFormat();

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

        dotenv.config({ debug: false, quiet: true });
        if ( !process.env.DOMAIN || !process.env.INDEX_URL ) {
            return false;
        }
        const url: string = process.env.DOMAIN + process.env.INDEX_URL;
        try {
            this.html = await fetch(url).then(res => res.text());
        } catch (e) {
            Narrator.error('Unexpected error downloading fixture list', e as Error);
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
            throw new Error('HTML for the "Tickets Availability" index page is empty');
        }
        switch (this.format) {
            case 2024: {

                // Every fixture on the page is contained within an A tag with the following class name - loop through all of these
                // to get the pertinent information that will help us to parse them all for selling arrangements
                const re: RegExp = /<a class="ticket-card fixture" href="(.+?)">(.+?)<\/a>/gis;
                let match : Nullable<RegExpExecArray>;
                while ( (match = re.exec(this.html)) !== null ) {

                    const url: string = match[1], section: string = match[2];

                    // The "info" block contains all the information about opposition and kick-off
                    const info: Nullable<RegExpMatchArray> = section.match(/<div class="info">.*<p>(.+?) [v|V] (.+?)<\/p>.*<span>(?:(.+?),\s*(\d{1,2}):(\d{2})([ap]m)|TBC)<\/span>/s);
                    if ( info == null || info.length != 7 ) {
                        // Don't throw an error - log it and proceed to the next fixture so one failure doesn't prevent emails from going out
                        Narrator.error('Unable to parse HTML for "' + url + '"');
                        continue;
                    }
                    const home: string = info[1];
                    const away: string = info[2];
                    const opposition: string = (home == 'Liverpool FC' ? away : home);
                    // We're only interested in the men's team here (although we could extend it in the future)
                    if ( opposition.toLowerCase().includes('women') || opposition.toLowerCase().includes('ladies') ) {
                        continue;
                    }

                    // Unfortunately, the kick-off date/time is formatted in such a way that Javascript will throw "Invalid Date" 
                    // if you try and convert directly, so a bit of interpretation is required (it's the 3:00pm that it doesn't like)
                    const ko: Date = info[3] === undefined ? new Date('0000-01-01T00:00:00.000Z') : new Date(info[3]);
                    if (info[3] !== undefined) {
                        const hours: number = parseInt(info[4]) + (info[6] == 'pm' ? 12: 0), minutes: number = parseInt(info[5]);
                        ko.setHours(hours);
                        ko.setMinutes(minutes);
                    }

                    // The remaining details (home/away and competition) helpfully have their own class identifiers
                    const l: Nullable<RegExpMatchArray> = section.match(/<span class="match-location">([HA])<\/span>/);
                    const venue: Venue = (l != null ? l[1] as 'H'|'A' : 'U');
                    // Some games now have the competition logo rather than the text so handle both scenarios 
                    const c: Nullable<RegExpMatchArray> = section.match(/<span class="comp-text">(.+?)<\/span>/);
                    const crest: Nullable<RegExpMatchArray> = section.match(/<img.*?alt="(.+?)".*?class="league-crest"/);
                    const logo: Nullable<string> = (crest != null ? crest[1] :  null);
                    const text: string = (c != null ? c[1] : 'Unknown');
                    const competition: string = (logo == null) ? text : logo;

                    // Now create the Fixture object and add it to the array for looping through later and individually parsing
                    const fixture: Fixture = new Fixture(url, opposition, venue, competition, ko);
                    this.fixtures.push(fixture);

                }
                break;
            }
            case 2026: {

                // With this format, not all fixtures appear on the page initially - only 15 will be displayed
                // and the rest will be lazy loaded.  However, the club will never play more than 15 games in a week nor 
                // try to see 15 games that imminently.  So, we are safe to not worry about the later fixtures and
                // that they will become visible before we need to worry about the sales dates.
                
                // Every fixture on the page is contained within an A tag with the following class name - loop through all of these
                // to get the pertinent information that will help us to parse them all for selling arrangements
                const re: RegExp = /<a.*?data-testid="hospitality-fixture-card".*?href="(.+?)">(.+?)<\/a>/gis;
                let match : Nullable<RegExpExecArray>;
                while ( (match = re.exec(this.html)) !== null ) {

                    const url: string = match[1], section: string = match[2];

                    // The "hospitality-fixture-card" block contains all the information about opposition and kick-off
                    const info: Nullable<RegExpMatchArray> = section.match(/<span.*?FixtureCard__koTime__.*?">(\d{1,2}):(\d{2})<\/span>.*?<span.*?FixtureCard__koDateText__.*?">(.*?)<\/span>.*?<span.*?data-testid="hospitality-fixture-card__home-team">(.*?)<\/span>.*?<span.*?data-testid="hospitality-fixture-card__away-team">(.*?)<\/span>.*?<div.*?FixtureCard__leagueName__.*?">(.*?)<\/span>.*?<span.*?FixtureCard__venue__.*?">(.*?)<\/span>/s);
                    if ( info == null || info.length != 8 ) {
                        // Don't throw an error - log it and proceed to the next fixture so one failure doesn't prevent emails from going out
                        Narrator.error('Unable to parse HTML for "' + url + '"');
                        continue;
                    }
                    const home: string = info[4];
                    const away: string = info[5];
                    const opposition: string = (home == 'Liverpool' ? away : home);
                    // We're only interested in the men's team here (although we could extend it in the future)
                    if ( home.toLowerCase().includes('u21') || away.toLowerCase().includes('u21') ) {
                        continue;
                    }
                    if ( opposition.toLowerCase().includes('women') || opposition.toLowerCase().includes('ladies') ) {
                        continue;
                    }

                    // Kick-off time is now 24 hours, so quite a bit easier to parse.  However, we don't get a year
                    // so we have to work that out ourselves - the logic is that if the fixture day/month is later
                    // than today then the fixture will be the same year as now; if it's before then it'll be next
                    // year (ie a January fixture being parsed in December)
                    const now: Date = new Date();
                    const ko: Date = info[3] === undefined ? new Date('0000-01-01T00:00:00.000Z') : new Date(info[3]);
                    if (ko.getMonth() < now.getMonth() || (ko.getMonth() == now.getMonth() && ko.getDate() < now.getDate())) {
                        ko.setFullYear(now.getFullYear() + 1);
                    } else {
                        ko.setFullYear(now.getFullYear());
                    }
                    if (info[3] !== undefined) {
                        const hours: number = parseInt(info[1]), minutes: number = parseInt(info[2]);
                        ko.setHours(hours);
                        ko.setMinutes(minutes);
                    }

                    // The remaining details (home/away and competition) helpfully have their own class identifiers
                    const venue: Venue = info[7] === 'Anfield' ? 'H' : 'A';
                    const competition: string = info[6];

                    // Now create the Fixture object and add it to the array for looping through later and individually parsing
                    const fixture: Fixture = new Fixture(url, opposition, venue, competition, ko);
                    this.fixtures.push(fixture);
                }

                break;
            }
        }
        return this.fixtures.length;

    }

    /**
     * Returns all fixtures belonging to the fixture list.
     * @param {boolean} sort - (Optional) Sort the fixtures by first sale date.
     * @return {Array<Fixture>} An array of Fixture objects previously found.
     */
    getFixtures(sort?: boolean): Array<Fixture> {
        if ( !sort ) {
            return this.fixtures;
        }
        // Make a copy of the fixtures variable (or the original will get sorted)
        const ordered: Array<Fixture> = [];
        this.fixtures.forEach((fixture) => {
            ordered.push(fixture);
        })
        ordered.sort((fixture1: Fixture, fixture2: Fixture) => {
            if ( fixture1.getActiveSaleCount() == 0 ) {
                return 1;
            }
            if ( fixture2.getActiveSaleCount() == 0 ) {
                return -1;
            }
            const start1: Array<number> = fixture1.getCalendarEvents().at(0)!.start as Array<number>;
            const start2: Array<number> = fixture2.getCalendarEvents().at(0)!.start as Array<number>;
            const sale1: number = (start1[0] * 100000000) + (start1[1] * 1000000) + (start1[2] * 10000) + (start1[3] * 100) + start1[4];
            const sale2: number = (start2[0] * 100000000) + (start2[1] * 1000000) + (start2[2] * 10000) + (start2[3] * 100) + start2[4];
            return (sale1 - sale2);
        });
        return ordered;
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
                Narrator.error('Unexpected error parsing fixture list', e as Error);
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
     * Returns any sales contained within this fixture list that have changed since this was last run.
     * @return {Array<ICS.EventAttributes>} Any sales dates for fixtures that have changed, in ICS format.
     */
    getChanges(): Array<ICS.EventAttributes> {
        let events: Array<ICS.EventAttributes> = [];
        this.fixtures.forEach((fixture) => {
            if ( fixture.getActiveSaleCount() > 0 && fixture.hasChanged() ) {
                events = events.concat(fixture.getCalendarEvents());
            }
        });
        return events;
    }

}