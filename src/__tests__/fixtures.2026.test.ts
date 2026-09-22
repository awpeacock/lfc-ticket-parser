import {describe, it, expect, jest} from '@jest/globals';
import * as fs from 'fs';

import { Fixture, FixtureList, Sale } from "../fixtures";
import setup, { Mocks } from "../setupTests";

setup();

describe('Parsing the fixture list', () => {

    jest.replaceProperty(process.env, 'HTML_FORMAT', '2026');
    
    const TOTAL: number = 6;
    const ACTIVE: number = 5;

    // Share the index class with all methods.  To save on processing/performance, we only want to
    // retrieve this the once.
    const index = new FixtureList();
    index.download();

    it('should correctly read from the index page', () => {
        let size: number = 0;
        expect(() => { size = index.find() }).not.toThrow();
        expect(size).toEqual(TOTAL);
    });

    it('should successfully parse all fixtures previously found', async () => {
        const success: boolean = await index.parseAll();
        expect(success).toEqual(true);
    });

    it('should have successfully produced Json strings for the relevant fixtures', () => {
        let valid: number = 0;
        index.getFixtures().forEach((fixture) => {
            if ( fixture.getActiveSaleCount() > 0 && fixture.getJson() != null ) {
                valid++;
            }
        });
        expect(valid).toEqual(ACTIVE);
    });

    it('should successfully recognise the competition for both text and images', () => {
        index.getFixtures().forEach((fixture) => {
            expect(fixture.getMatch().includes('Unknown')).toBeFalsy();
            if ( fixture.getMatch().includes('Newcastle United') || fixture.getMatch().includes('Nottingham Forest') ) {
                expect(fixture.getMatch().includes('Premier League')).toBeTruthy();
            }
        })
    });

    it('should not throw errors if it cannot parse a fixture on the index page but move on to the next fixture', async () => {
        
        const fetch = jest.spyOn(global, 'fetch');
        fetch.mockImplementationOnce(() => Promise.reject('Failure retrieving HTML')); 

        // This should catch if the fixture list didn't download (is empty error)
        const faulty: FixtureList = new FixtureList();
        expect(faulty.download()).resolves.toBe(false);
        expect(() => { faulty.find() }).toThrow();

        // This should catch if the HTML wasn't what was expected
        const download = jest.spyOn(FixtureList.prototype, 'download');
        download.mockImplementationOnce(async function(this: Fixture) { 
            this['html'] = '<a data-testid="hospitality-fixture-card" href="fixture.html"><div class="hospitality-fixture-card_hospitalityFixtureCard__matchDetails__xz4ac" data-testid="hospitality-fixture-card__match-details">Not what is expected</div></a>';
            return true;
        });
        await faulty.download();
        expect(() => { faulty.find() }).not.toThrow();
        expect(Mocks.console.error).toHaveBeenCalled();
        
    });

    it('should return false if it cannot parse any fixture pages', async () => {
        
        const fetch = jest.spyOn(global, 'fetch');
        fetch.mockImplementationOnce(() => Promise.reject('Failure retrieving HTML')); 
        
        // This should catch if a fixture page cannot download
        expect(index.parseAll()).resolves.toBe(false);

        const download = jest.spyOn(Fixture.prototype, 'download');
        download.mockImplementationOnce(async function(this: Fixture) { 
            this['html'] = fs.readFileSync('./src/__mocks__/2026/availability-home-active.html', 'utf-8');
            return true;
        });
        // This should catch if a fixture page cannot parse
        expect(index.parseAll()).resolves.toBe(false);

    });

    it('should return fixtures sorted by earliest sale date', () => {
        const random: FixtureList = new FixtureList();
        const order: Array<number> = [4, 1, 0, 1, 5, 3, 2, 2];
        // Some heavy manipulation of the data is required to ensure we can test this accurately
        for ( let f = 0; f < ACTIVE; f++ ) {
            const fixture: Fixture = index.getFixtures().at(f)!;
            const date: Date = new Date();
            date.setDate(date.getDate() + order[f]);
            const sale: Sale = fixture['sales'][0];
            sale['date'] = date;
            sale['status'] = Status.PENDING;
            sale['description'] = 'Additional Members Sale';
            fixture['sales'][0] = sale;
            random['fixtures'][f] = fixture;
        }
        const ordered = random.getFixtures(true);
        for ( let f = 0; f < ACTIVE - 1; f++ ) {
            expect(ordered[f]['sales'][0]['date']! <= ordered[f+1]['sales'][0]['date']!).toBeTruthy();
        }
        expect(ordered[0]).not.toEqual(random.getFixtures().at(0));
        
        for ( let s = 0; s < random['fixtures'][0]['sales'].length; s++ ) {
            random['fixtures'][0]['sales'][s]['status'] = Status.ENDED;
        }
        for ( let s = 0; s < random['fixtures'][3]['sales'].length; s++ ) {
            random['fixtures'][3]['sales'][s]['status'] = Status.ENDED;
        }
        const reordered = random.getFixtures(true);
        for ( let f = 0; f < ACTIVE - 3; f++ ) {
            expect(reordered[f]['sales'][0]['date']! <= reordered[f+1]['sales'][0]['date']!).toBeTruthy();
        }for ( let f = ACTIVE - 2; f < ACTIVE; f++ ) {
            expect(reordered[f]['sales'][0]['status']!).toBe(Status.ENDED);
        }
        expect(reordered[0]).not.toEqual(random.getFixtures().at(0));
    });

});

describe('Parsing an active home fixture', () => {

    const fixture: Fixture = new Fixture('/tickets/tickets-match/liverpool-v-nottingham-forest-english-premier-league-20260829', 'Nottingham Forest', 'H', 'Premier League', new Date('2026-08-29 12:30'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2026-nottingham-forest-h-premier-league');
    });

    it('should successfully assign the correct season to the fixture', () => {
        expect(Reflect.get(fixture, 'season')).toBe(2026);
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Nottingham Forest (H) - Premier League (2026-27)');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(6);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(3);
    });

    it('should successfully generate a JSON string with sales dates', () => {
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"2026-nottingham-forest-h-premier-league","match":"Nottingham Forest (H) - Premier League (2026-27)","sales":[{"description":"Additional Members Sale Registration","date":"Mon Aug 17 2026 11:00:00 GMT+0100 (British Summer Time)"},{"description":"Additional Members Sale","date":"Mon Aug 24 2026 11:00:00 GMT+0100 (British Summer Time)"},{"description":"Young Adult Area Ballot","date":"Tue Aug 18 2026 10:00:00 GMT+0100 (British Summer Time)"}]}}');
    });

    it('should throw errors if it cannot parse the fixture page', async () => {

        const fetch = jest.spyOn(global, 'fetch');
        fetch.mockImplementationOnce(() => Promise.reject('Failure retrieving HTML')); 

        const faulty: Fixture = new Fixture('/tickets/tickets-match/liverpool-v-nottingham-forest-english-premier-league-20260829', 'Nottingham Forest', 'H', 'Premier League', new Date('2026-08-29 12:30'));
        await faulty.download();
        expect(() => faulty.find()).toThrow();

    });

    it('should throw errors if the HTML of the fixture page does not match the expected fixture', async () => {

        const faulty: Fixture = new Fixture('/tickets/tickets-match/liverpool-v-nottingham-forest-english-premier-league-20260829', 'Nottingham Forest', 'H', 'Premier League', new Date('2026-08-29 12:30'));
        const download = jest.spyOn(faulty, 'download');
        download.mockImplementationOnce(async function(this: Fixture) { 
            this['html'] = fs.readFileSync('./src/__mocks__/2026/availability-away-subject.html', 'utf-8');
            return true;
        });

        await faulty.download();
        expect(() => faulty.find()).toThrow();

    });

});

describe('Parsing an active home fixture with specfic game criteria', () => {

    const fixture: Fixture = new Fixture('/tickets/match/liverpool-v-manchester-city-english-premier-league-20261011', 'Manchester City', 'H', 'Premier League', new Date('2026-10-11 16:30'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2026-manchester-city-h-premier-league');
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Manchester City (H) - Premier League (2026-27)');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(10);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(7);
    });

    it('should successfully generate a JSON string with sales dates', () => {
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"2026-manchester-city-h-premier-league","match":"Manchester City (H) - Premier League (2026-27)","sales":[{"description":"Additional Members Sale Registration (4+)","date":"Mon Sep 28 2026 11:00:00 GMT+0100 (British Summer Time)"},{"description":"Additional Members Sale Registration (3+)","date":"Mon Sep 28 2026 11:00:00 GMT+0100 (British Summer Time)"},{"description":"Additional Members Sale Registration (2+)","date":"Mon Sep 28 2026 11:00:00 GMT+0100 (British Summer Time)"},{"description":"Additional Members Sale Registration (1+)","date":"Mon Sep 28 2026 11:00:00 GMT+0100 (British Summer Time)"},{"description":"Additional Members Sale Registration","date":"Mon Sep 28 2026 11:00:00 GMT+0100 (British Summer Time)"},{"description":"Additional Members Sale (4+)","date":"Mon Oct 05 2026 11:00:00 GMT+0100 (British Summer Time)"},{"description":"Young Adult Area Ballot","date":"Tue Sep 29 2026 10:00:00 GMT+0100 (British Summer Time)"}]}}');
    });

});

describe('Parsing an active away fixture', () => {

    const fixture: Fixture = new Fixture('/tickets/ticket-match/brentford-v-liverpool-20261017', 'Brentford', 'A', 'Premier League', new Date('2026-10-17 15:00'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2026-brentford-a-premier-league');
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Brentford (A) - Premier League (2026-27)');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(3);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(3);
    });

    it('should successfully generate a JSON string with sales dates', () => {
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"2026-brentford-a-premier-league","match":"Brentford (A) - Premier League (2026-27)","sales":[{"description":"ST Holders and Members Sale (19+)","date":"Tue Sep 22 2026 08:15:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale (18+)","date":"Wed Sep 23 2026 11:00:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale (17+)","date":"Wed Sep 23 2026 13:00:00 GMT+0100 (British Summer Time)"}]}}');
    });
});

describe('Parsing an active away fixture with potential sales', () => {

    const fixture: Fixture = new Fixture('/tickets/ticket-match/newcastle-united-v-liverpool-20260823', 'Newcastle United', 'A', 'Premier League', new Date('2026-08-23 16:30'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2026-newcastle-united-a-premier-league');
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Newcastle United (A) - Premier League (2026-27)');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(7);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(2);
    });

    it('should successfully generate a JSON string with sales dates', () => {
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"2026-newcastle-united-a-premier-league","match":"Newcastle United (A) - Premier League (2026-27)","sales":[{"description":"ST Holders and Members Sale (2+)","date":"Wed Aug 05 2026 13:00:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale (1+)","date":"Wed Aug 05 2026 15:00:00 GMT+0100 (British Summer Time)"}]}}');
    });

});

describe('Parsing an active away European fixture', () => {

    const fixture: Fixture = new Fixture('/tickets/match/liverpool-champions-league-lask-202627', 'LASK', 'A', 'Champions League', new Date('2026-10-14 20:00'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2026-lask-a-champions-league');
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('LASK (A) - Champions League (2026-27)');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(3);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(3);
    });

    it('should successfully generate a JSON string with sales dates', () => {
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"2026-lask-a-champions-league","match":"LASK (A) - Champions League (2026-27)","sales":[{"description":"ST Holders and Members Sale (9+)","date":"Wed Sep 23 2026 08:15:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale (8+)","date":"Thu Sep 24 2026 08:15:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale (7+)","date":"Thu Sep 24 2026 13:00:00 GMT+0100 (British Summer Time)"}]}}');
    });

});
/*
describe('Parsing an active fixture with a TBC fixture date', () => {

    const fixture: Fixture = new Fixture('/tickets/tickets-availability/nottingham-forest-v-liverpool-fc-tbc-532', 'Nottingham Forest', 'A', 'Premier League', new Date('0000-01-01T00:00:00.000Z'));
    fixture.download();

    const date = new Date();
    const year = date.getMonth() > 4 ? date.getFullYear() : date.getFullYear() - 1;

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual(year + '-nottingham-forest-a-premier-league');
    });

    it('should successfully assign the correct season to the fixture', () => {
        expect(Reflect.get(fixture, 'season')).toBe(year);
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Nottingham Forest (A) - Premier League (' + year + '-' + (year - 1999) + ')');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(4);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(4);
    });

    it('should successfully generate a JSON string with sales dates', () => {
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"' + year + '-nottingham-forest-a-premier-league","match":"Nottingham Forest (A) - Premier League (' + year + '-' + (year-1999) +')","sales":[{"description":"ST Holders and Members Sale (12+)","date":"Tue Jan 27 2026 08:15:00 GMT+0000 (Greenwich Mean Time)"},{"description":"ST Holders and Members Sale (11+)","date":"Wed Jan 28 2026 11:00:00 GMT+0000 (Greenwich Mean Time)"},{"description":"ST Holders and Members Sale (10+)","date":"Wed Jan 28 2026 13:00:00 GMT+0000 (Greenwich Mean Time)"},{"description":"ST Holders and Members Sale (9+)","date":"Wed Jan 28 2026 15:00:00 GMT+0000 (Greenwich Mean Time)"}]}}');
    });

    it('should throw errors if it cannot parse the fixture page', async () => {

        const fetch = jest.spyOn(global, 'fetch');
        fetch.mockImplementationOnce(() => Promise.reject('Failure retrieving HTML')); 

        const faulty: Fixture = new Fixture('/tickets/tickets-availability/nottingham-forest-v-liverpool-fc-tbc-532', 'Nottingham Forest', 'A', 'Premier League', new Date('0000-01-01T00:00:00.000Z'));
        await faulty.download();
        expect(() => faulty.find()).toThrow();

    });

    it('should throw errors if the HTML of the fixture page does not match the expected fixture', async () => {

        const faulty: Fixture = new Fixture('/tickets/tickets-availability/nottingham-forest-v-liverpool-fc-tbc-532', 'Nottingham Forest', 'A', 'Premier League', new Date('0000-01-01T00:00:00.000Z'));
        const download = jest.spyOn(faulty, 'download');
        download.mockImplementationOnce(async function(this: Fixture) { 
            this['html'] = fs.readFileSync('./src/__mocks__/availability-home-multiple.html', 'utf-8');
            return true;
        });

        await faulty.download();
        expect(() => faulty.find()).toThrow();

    });

});
*/
describe('Parsing an inactive home fixture', () => {

    const fixture: Fixture = new Fixture('/tickets/match/liverpool-v-brighton-and-hove-albion-english-premier-league-20261025', 'Brighton and Hove Albion', 'H', 'Premier League', new Date('2026-10-25 14:00'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2026-brighton-and-hove-albion-h-premier-league');
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Brighton and Hove Albion (H) - Premier League (2026-27)');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(4);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(0);
    });

    it('should NOT generate a JSON string', () => {
        expect(fixture.getJson()).toBeNull();
    });

});
/*
describe('Parsing an inactive away fixture', () => {

    const fixture: Fixture = new Fixture('/tickets/tickets-availability/manchester-united-v-liverpool-fc-1-sep-2024-0400pm-364', 'Manchester United', 'A', 'Premier League', new Date('2024-09-01 16:00'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2024-manchester-united-a-premier-league');
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Manchester United (A) - Premier League (2024-25)');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(1);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(0);
    });

    it('should NOT generate a JSON string', () => {
        expect(fixture.getJson()).toBeNull();
    });

});
*/