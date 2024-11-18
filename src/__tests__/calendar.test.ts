import {describe, it, expect, jest, beforeEach} from '@jest/globals';
import dotenv, { DotenvConfigOutput } from 'dotenv';
import * as ICS from 'ics';
import * as nodemailer from 'nodemailer';
import { NodemailerMock } from 'nodemailer-mock';

import { FixtureList, Sale } from "../fixtures";
import { Email } from '../distribution';
import { Backup } from '../persistence';
import setup, { Mocks } from "../setupTests";

setup();

describe('Converting the fixture list and sending the calendar email', () => {

    const { mock } = nodemailer as unknown as NodemailerMock;

    const index: FixtureList = new FixtureList();
    let events: Array<ICS.EventAttributes> = new Array<ICS.EventAttributes>();

    beforeEach(() => {
        mock.reset();
        mock.setSuccessResponse('250 OK');
    });

    it('should successfully create an array of calendar events', async () => {

        await index.download();
        expect(() => { index.find() }).not.toThrow();
        const success: boolean = await index.parseAll();
        expect(success).toEqual(true);
        expect(() => { events = index.getChanges() }).not.toThrow();
        expect(events[0]).toEqual({productId: 'lfctickets/ics',title: 'Brentford (H) : Additional Members Sale',start: [2024,8,19,11,0],duration: {minutes: 60},busyStatus: 'BUSY'});
    });

    it('should return null if an attempt is made to retrieve an event for an invalid sale', () => {
        const sale: Sale = new Sale('Event in the past', Status.ENDED, null);
        expect(sale.isValid()).toBe(false);
        expect(sale.getCalendarEvent()).toBeNull();    
    });

    it('should successfully produce the calendar file', async () => {
        const email: Email = new Email();
        email.construct(events);
        expect(email['ics']).not.toBeNull();
        expect(email['ics']!.value!.startsWith('BEGIN:VCALENDAR')).toBe(true);
        expect(email['ics']!.value!.endsWith('END:VCALENDAR\r\n')).toBe(true);
    });

    it('should successfully merge sales on the same date into a "bulk" sale', async () => {
        const email: Email = new Email();
        email.construct(Mocks.events.bulk.sales);
        expect(email['ics']!.value!.includes('Chelsea (H) : Members Sale')).toBe(false);
        expect(email['ics']!.value!.includes('Brighton and Hove Albion (H) : Members Sale')).toBe(false);
        expect(email['ics']!.value!.includes('Aston Villa (H) : Members Sale')).toBe(false);
        expect(email['ics']!.value!.match(/Bulk Sale \(Chelsea\\, Brighton and Hove Albion\\, Aston Villa\) : Memb\s*ers Sale \(13\+\)/gis)).not.toBeNull();
        expect(email['ics']!.value!.match(/Bulk Sale \(Chelsea\\, Brighton and Hove Albion\\, Aston Villa\\, Arsen\s*al\) : Members Sale \(4\+\\, General\\, 3\+\)/gis)).not.toBeNull();
    });

    it('should successfully merge registrations on the same date into a "bulk" registration', async () => {
        const email: Email = new Email();
        email.construct(Mocks.events.bulk.registration);
        expect(email['ics']!.value!.includes('Chelsea (H) : Members Ticket Sale Registration')).toBe(false);
        expect(email['ics']!.value!.includes('Brighton and Hove Albion (H) : Members Ticket Sale Registration')).toBe(false);
        expect(email['ics']!.value!.includes('Aston Villa (H) : Members Ticket Sale Registration')).toBe(false);
        expect(email['ics']!.value!.match(/Registration \(Chelsea\\, Brighton and Hove Albion\\, Aston Villa\) : M\s*embers Ticket Sale \(13\+\\, 4\+\\, General\)/gis)).not.toBeNull();
        // Re-test with a different order so as to test every eventuality
        const events: Array<ICS.EventAttributes> = [];
        events.push(Mocks.events.bulk.registration[2]);
        events.push(Mocks.events.bulk.registration[4]);
        email.construct (events);
        expect(email['ics']!.value!.includes('Brighton and Hove Albion (H) : Members Ticket Sale Registration')).toBe(false);
        expect(email['ics']!.value!.includes('Aston Villa (H) : Members Ticket Sale Registration')).toBe(false);
        expect(email['ics']!.value!.match(/Registration \(Brighton and Hove Albion\\, Aston Villa\) : Members Tic\s*ket Sale \(13\+\)/gis)).not.toBeNull();
    });

    it('should successfully merge additional registrations on the same date into one registration', async () => {
        const email: Email = new Email();
        email.construct(Mocks.events.ams.registration);
        expect(email['ics']!.value!.includes('Manchester City (H) : Additional Members 4+ Sale Registration')).toBe(false);
        expect(email['ics']!.value!.includes('Manchester City (H) : Additional Members 3+ Sale Registration')).toBe(false);
        expect(email['ics']!.value!.includes('Manchester City (H) : Additional Members 2+ Sale Registration')).toBe(false);
        expect(email['ics']!.value!.match(/Registration \(Manchester City\) : Additional Members Sale \(4\+\\, 3\+\\,\s*2\+\)/gis)).not.toBeNull();
    });

    it('should ignore any sales dates in the past', async () => {
        const email: Email = new Email();
        const backup: Backup = new Backup(new Date(), Mocks.events.expired);
        email.construct(backup.getEvents());
        const re: RegExp = /BEGIN:VEVENT/;
        const matches: Nullable<RegExpExecArray> = re.exec(email['ics']!.value!);
        expect(matches).toBeNull();
    });

    it('should successfully merge absolute duplicates', async () => {
        const email: Email = new Email();
        const events: Array<ICS.EventAttributes> = [];
        Mocks.events.away.forEach((e) => {
            events.push(e);
        });
        events.push(Mocks.events.away[1]);
        const backup: Backup = new Backup(new Date(), events);
        email.construct(backup.getEvents());
        const re: RegExp = /BEGIN:VEVENT/g;
        const matches: Nullable<RegExpMatchArray> = email['ics']!.value!.match(re);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBe(Mocks.events.away.length);
    });

    it('should throw errors if it cannot produce the calendar file', async () => {
        const create = jest.spyOn(ICS, 'createEvents');
        create.mockImplementationOnce(() => { return { error: 'Something went wrong', value: null }}); 

        const email: Email = new Email();
        expect(() => email.construct(index.getChanges())).toThrow();
    });

    it('should successfully send the email and return true', async () => {
        process.env.DEBUG = 'true';
        const date: string = new Date().getDate() + '/' + (new Date().getMonth()+1) + '/' + new Date().getFullYear();
        const email: Email = new Email();
        email.construct(index.getChanges());
        await expect(email.sendEvents(index.getFixtures(true))).resolves.toBe(true);
        const mails = mock.getSentMail();
        expect(mails).not.toBeNull();
        expect(mails.length).toBe(1);
        expect(mails[0].from!.toString().startsWith(Email.FROM_NAME)).toBe(true);
        expect(mails[0].subject).toEqual(Email.SUBJECT_SALES + ' (' + date + ')');
        expect(mails[0].text).toContain(Email.BODY_SALES);
        expect(mails[0].html).toContain('<p>' + Email.BODY_SALES + '</p>');
        expect(mails[0].text).toContain('Manchester City (H) - Premier League (2024-25)\n * 14 Nov 2024, 10:00 : Additional Members 4+ Sale Registration');
        expect(mails[0].html).toContain('<p><strong>Aston Villa (H) - Premier League (2024-25)</strong></p><ul><li>4 Sept 2024, 8:15 : Members Sale (13+)</li>');
        expect(mails[0].attachments).not.toBeUndefined();
        expect(mails[0].attachments).not.toBeNull();
        expect(mails[0].attachments!.length).toBe(1);
        expect(mails[0].attachments![0].content!.toString().startsWith('BEGIN:VCALENDAR')).toBe(true);
        expect(mails[0].attachments![0].content!.toString().endsWith('END:VCALENDAR\r\n')).toBe(true);
    });

    it('should refuse to send an empty email and return true', async () => {
        const email: Email = new Email();
        email.construct([]);
        await expect(email.sendEvents()).resolves.toBe(true);
        const mails = mock.getSentMail();
        expect(mails.length).toBe(0);        
    });

    it('should successfully send an error email and return true', async () => {
        delete process.env.EMAIL_ERROR;
        const email: Email = new Email();
        await expect(email.sendError('An error message', new Error('Error detail'))).resolves.toBe(true);
        const mails = mock.getSentMail();
        expect(mails).not.toBeNull();
        expect(mails.length).toBe(1);
        expect(mails[0].from!.toString().startsWith(Email.FROM_NAME)).toBe(true);
        expect(mails[0].subject).toEqual(Email.SUBJECT_ERROR);
        expect(mails[0].text).toContain('An error message');
        expect(mails[0].text).toContain('Error detail');
        expect(mails[0].attachments).toBeUndefined();
    });

    it('should successfully handle errors in the email sending process and return false', async () => {
        const email: Email = new Email();
        email.construct(index.getChanges());

        mock.setSuccessResponse('200 OK');
        await expect(email.sendEvents()).resolves.toBe(false);

        mock.reset();
        mock.setShouldFailOnce(true);
        await expect(email.sendEvents()).resolves.toBe(false);
        expect(mock.getSentMail().length).toBe(0);
    });

    it('should successfully drop out of the email process if the host has not been set', async () => {
        const config = jest.spyOn(dotenv, 'config');
        const output: DotenvConfigOutput = {};
        config.mockImplementationOnce(() => { return output; });
        delete process.env.EMAIL_HOST;

        const email: Email = new Email();
        email.construct(index.getChanges());
        await expect(email.sendEvents()).resolves.toBe(false);
        const mails = mock.getSentMail();
        expect(mails.length).toBe(0);
    });

});