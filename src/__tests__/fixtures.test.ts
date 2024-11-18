import {describe, it, expect, jest} from '@jest/globals';
import * as fs from 'fs';

import { Fixture, FixtureList, Sale } from "../fixtures";
import setup from "../setupTests";

setup();

describe('Parsing the fixture list', () => {

    // Share the index class with all methods.  To save on processing/performance, we only want to
    // retrieve this the once.
    const index = new FixtureList();
    index.download();

    it('should correctly read from the index page', () => {
        let size: number = 0;
        expect(() => { size = index.find() }).not.toThrow();
        expect(size).toEqual(8);
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
        expect(valid).toEqual(6);
    });

    it('should throw errors if it cannot parse the index page', async () => {
        
        const fetch = jest.spyOn(global, 'fetch');
        fetch.mockImplementationOnce(() => Promise.reject('Failure retrieving HTML')); 

        // This should catch if the fixture list didn't download (is empty error)
        const faulty: FixtureList = new FixtureList();
        expect(faulty.download()).resolves.toBe(false);
        expect(() => { faulty.find() }).toThrow();

        // This should catch if the HTML wasn't what was expected
        const download = jest.spyOn(FixtureList.prototype, 'download');
        download.mockImplementationOnce(async function(this: Fixture) { 
            this['html'] = '<a class="ticket-card fixture" href="fixture.html"><div class="info">Not what is expected</div></a>';
            return true;
        });
        await faulty.download();
        expect(() => { faulty.find() }).toThrow();
        
    });

    it('should return false if it cannot parse any fixture pages', async () => {
        
        const fetch = jest.spyOn(global, 'fetch');
        fetch.mockImplementationOnce(() => Promise.reject('Failure retrieving HTML')); 
        
        // This should catch if a fixture page cannot download
        expect(index.parseAll()).resolves.toBe(false);

        const download = jest.spyOn(Fixture.prototype, 'download');
        download.mockImplementationOnce(async function(this: Fixture) { 
            this['html'] = fs.readFileSync('./src/__mocks__/availability-home-multiple.html', 'utf-8');
            return true;
        });
        // This should catch if a fixture page cannot parse
        expect(index.parseAll()).resolves.toBe(false);

    });

    it('should return fixtures sorted by earliest sale date', () => {
        const random: FixtureList = new FixtureList();
        const order: Array<number> = [4, 1, 0, 1, 5, 3, 2, 2];
        // Some heavy manipulation of the data is required to ensure we can test this accurately
        for ( let f = 0; f < 8; f++ ) {
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
        for ( let f = 0; f < 7; f++ ) {
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
        for ( let f = 0; f < 5; f++ ) {
            expect(reordered[f]['sales'][0]['date']! <= reordered[f+1]['sales'][0]['date']!).toBeTruthy();
        }for ( let f = 6; f < 8; f++ ) {
            expect(reordered[f]['sales'][0]['status']!).toBe(Status.ENDED);
        }
        expect(reordered[0]).not.toEqual(random.getFixtures().at(0));
    });

});

describe('Parsing an active home fixture', () => {

    const fixture: Fixture = new Fixture('/tickets/tickets-availability/liverpool-fc-v-brentford-25-aug-2024-0430pm-342', 'Brentford', 'H', 'Premier League', new Date('2024-08-25 16:30'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2024-brentford-h-premier-league');
    });

    it('should successfully assign the correct season to the fixture', () => {
        expect(Reflect.get(fixture, 'season')).toBe(2024);
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Brentford (H) - Premier League (2024-25)');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(5);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(1);
    });

    it('should successfully generate a JSON string with sales dates', () => {
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"2024-brentford-h-premier-league","match":"Brentford (H) - Premier League (2024-25)","sales":[{"description":"Additional Members Sale","date":"Mon Aug 19 2024 11:00:00 GMT+0100 (British Summer Time)"}]}}');
    });

    it('should throw errors if it cannot parse the fixture page', async () => {

        const fetch = jest.spyOn(global, 'fetch');
        fetch.mockImplementationOnce(() => Promise.reject('Failure retrieving HTML')); 

        const faulty: Fixture = new Fixture('/tickets/tickets-availability/liverpool-fc-v-brentford-25-aug-2024-0430pm-342', 'Brentford', 'H', 'Premier League', new Date('2024-08-25 16:30'));
        await faulty.download();
        expect(() => faulty.find()).toThrow();

    });

    it('should throw errors if the HTML of the fixture page does not match the expected fixture', async () => {

        const faulty: Fixture = new Fixture('/tickets/tickets-availability/liverpool-fc-v-brentford-25-aug-2024-0430pm-342', 'Brentford', 'H', 'Premier League', new Date('2024-08-25 16:30'));
        const download = jest.spyOn(faulty, 'download');
        download.mockImplementationOnce(async function(this: Fixture) { 
            this['html'] = fs.readFileSync('./src/__mocks__/availability-home-multiple.html', 'utf-8');
            return true;
        });

        await faulty.download();
        expect(() => faulty.find()).toThrow();

    });

});

describe('Parsing an active home fixture with multiple sales', () => {

    const fixture: Fixture = new Fixture('/tickets/tickets-availability/liverpool-fc-v-chelsea-19-oct-2024-0530pm-347', 'Chelsea', 'H', 'Premier League', new Date('2024-10-19 17:30'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2024-chelsea-h-premier-league');
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Chelsea (H) - Premier League (2024-25)');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(5);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(2);
    });

    it('should successfully generate a JSON string with sales dates', () => {
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"2024-chelsea-h-premier-league","match":"Chelsea (H) - Premier League (2024-25)","sales":[{"description":"Members Sale (13+)","date":"Wed Sep 04 2024 08:15:00 GMT+0100 (British Summer Time)"},{"description":"Members Sale (4+)","date":"Thu Sep 05 2024 08:15:00 GMT+0100 (British Summer Time)"}]}}');
    });

});

describe('Parsing an active away fixture with multiple sales', () => {

    const fixture: Fixture = new Fixture('/tickets/tickets-availability/wolverhampton-wanderers-v-liverpool-fc-28-sep-2024-0530pm-372', 'Wolverhampton Wanderers', 'A', 'Premier League', new Date('2024-09-28 17:30'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2024-wolverhampton-wanderers-a-premier-league');
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Wolverhampton Wanderers (A) - Premier League (2024-25)');
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
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"2024-wolverhampton-wanderers-a-premier-league","match":"Wolverhampton Wanderers (A) - Premier League (2024-25)","sales":[{"description":"ST Holders and Members Sale (11+)","date":"Mon Sep 02 2024 08:15:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale (10+)","date":"Tue Sep 03 2024 11:00:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale (9+)","date":"Tue Sep 03 2024 13:00:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale (8+)","date":"Tue Sep 03 2024 15:00:00 GMT+0100 (British Summer Time)"}]}}');
    });

});

describe('Parsing an active away fixture with potential sales', () => {

    const fixture: Fixture = new Fixture('/tickets/tickets-availability/manchester-utd-v-liverpool-fc-1-sep-2024-0400pm-364', 'Manchester United', 'A', 'Premier League', new Date('2024-09-01 16:00'));
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
        expect(size).toEqual(4);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(3);
    });

    it('should successfully generate a JSON string with sales dates', () => {
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"2024-manchester-united-a-premier-league","match":"Manchester United (A) - Premier League (2024-25)","sales":[{"description":"ST Holders and Members Sale (7+)","date":"Wed Aug 28 2024 11:00:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale (6+)","date":"Wed Aug 28 2024 13:00:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale (5+)","date":"Wed Aug 28 2024 15:00:00 GMT+0100 (British Summer Time)"}]}}');
    });

});

describe('Parsing an active away European fixture', () => {

    const fixture: Fixture = new Fixture('/tickets/tickets-availability/ac-milan-v-liverpool-fc-17-sep-2024-0800pm-375', 'AC Milan', 'A', 'Champions League', new Date('2024-09-17 20:00'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2024-ac-milan-a-champions-league');
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('AC Milan (A) - Champions League (2024-25)');
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
        expect(fixture.getJson()).toEqual('{"fixture":{"id":"2024-ac-milan-a-champions-league","match":"AC Milan (A) - Champions League (2024-25)","sales":[{"description":"ST Holders and Members Sale (1+)","date":"Fri Sep 06 2024 11:00:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Registration","date":"Fri Sep 06 2024 08:15:00 GMT+0100 (British Summer Time)"},{"description":"ST Holders and Members Sale","date":"Wed Sep 11 2024 08:15:00 GMT+0100 (British Summer Time)"}]}}');
    });

});

describe('Parsing an inactive home fixture', () => {

    const fixture: Fixture = new Fixture('/tickets/tickets-availability/liverpool-fc-v-nottingham-forest-14-sep-2024-0300pm-343', 'Nottingham Forest', 'H', 'Premier League', new Date('2024-09-14 15:00'));
    fixture.download();

    it('should successfully generate a unique ID', () => {
        expect(fixture.id).toEqual('2024-nottingham-forest-h-premier-league');
    });

    it('should successfully generate a match string', () => {
        expect(fixture.getMatch()).toEqual('Nottingham Forest (H) - Premier League (2024-25)');
    });

    it('should successfully parse', () => {
        let size: number = 0;
        expect(() => { size = fixture.find() }).not.toThrow();
        expect(size).toEqual(5);
    });

    it('should successfully recognise the number of valid sales', () => {
        expect(fixture.getActiveSaleCount()).toEqual(0);
    });

    it('should NOT generate a JSON string', () => {
        expect(fixture.getJson()).toBeNull();
    });

});

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

describe('Sales dates', () => {

    const pending:Sale = new Sale('Additional Members Sale', Status.PENDING, new Date('2024-09-01 09:00'));
    const ended:Sale = new Sale('Members Sale (13+)', Status.ENDED, new Date('2024-08-01 09:00'));
    const available:Sale = new Sale('Members Sale (13+)', Status.AVAILABLE, null);
    const ambulant:Sale = new Sale('Members who require a wheelchair bay or ambulant seating ONLY (4+)', Status.PENDING, new Date('2024-09-01 09:00'));
    const hospitality:Sale = new Sale('Hospitality', Status.PENDING, new Date('2024-09-01 09:00'));

    it('should successfully recognise a PENDING sale as valid', () => {
        expect(pending.isValid()).toEqual(true);
    });

    it('should successfully recognise an ENDED sale as invalid', () => {
        expect(ended.isValid()).toEqual(false);
    });

    it('should successfully recognise an AVAILABLE sale as invalid', () => {
        expect(available.isValid()).toEqual(false);
    });

    it('should successfully recognise a sale for ambulant seating as invalid', () => {
        expect(ambulant.isValid()).toEqual(false);
    });

    it('should successfully recognise a sale for hospitality seating as invalid', () => {
        expect(hospitality.isValid()).toEqual(false);
    });

    it('should successfully return a Json string for a PENDING sale', () => {
        expect(pending.getJson()).toEqual('{"description":"Additional Members Sale","date":"Sun Sep 01 2024 09:00:00 GMT+0100 (British Summer Time)"}');
    });

    it('should return null for an ENDED sale', () => {
        expect(ended.getJson()).toBeNull();
    });

    it('should return null for an AVAILABLE sale', () => {
        expect(available.getJson()).toBeNull();
    });

    it('should return null for a sale for ambulant seating', () => {
        expect(ambulant.getJson()).toBeNull();
    });

    it('should return null for a sale for hospitality seating', () => {
        expect(hospitality.getJson()).toBeNull();
    });

    it('should return a title for a valid sale', () => {
        expect(pending.getTitle()).toEqual('1 Sept 2024, 9:00 : Additional Members Sale');
    });

    it('should return a null title for an invalid sale', () => {
        expect(hospitality.getTitle()).toBeNull();
    });

});