import {jest} from '@jest/globals';
import * as fs from 'fs';
import * as ICS from 'ics';

const today: Date = new Date();
const month: number = today.getMonth() == 11 ? 1 : today.getMonth() + 2;
const year: number = month == 1 ? today.getFullYear() + 1 :  today.getFullYear();

const bulk: {[key: string]: Array<ICS.EventAttributes>} = {
    registration: [
        {
            productId: 'lfctickets/ics',
            title: 'Chelsea (H) : Members Ticket Sale Registration (13+)',
            start: [year, month, 1, 10, 0],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Chelsea (H) : Members Ticket Sale Registration (4+)',
            start: [year, month, 1, 10, 0],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Brighton and Hove Albion (H) : Members Ticket Sale Registration (13+)',
            start: [year, month, 1, 10, 0],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Brighton and Hove Albion (H) : Members Ticket Sale Registration',
            start: [year, month, 1, 10, 0],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Aston Villa (H) : Members Ticket Sale Registration (13+)',
            start: [year, month, 1, 10, 0],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Aston Villa (H) : Members Ticket Sale Registration',
            start: [year, month, 1, 10, 0],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        }
    ],
    sales: [
        {
            productId: 'lfctickets/ics',
            title: 'Chelsea (H) : Members Sale (13+)',
            start: [year, month, 8, 8, 15],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Chelsea (H) : Members Sale (4+)',
            start: [year, month, 9, 8, 15],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Brighton and Hove Albion (H) : Members Sale (13+)',
            start: [year, month, 8, 8, 15],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Brighton and Hove Albion (H) : Members Sale',
            start: [year, month, 9, 8, 15],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Aston Villa (H) : Members Sale (13+)',
            start: [year, month, 8, 8, 15],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Aston Villa (H) : Members Sale',
            start: [year, month, 9, 8, 15],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Arsenal (H) : Members Sale (3+)',
            start: [year, month, 9, 8, 15],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        }      
    ]
};

const ams: {[key: string]: Array<ICS.EventAttributes>} = {
    registration: [
        {
            productId: 'lfctickets/ics',
            title: 'Manchester City (H) : Additional Members 4+ Sale Registration',
            start: [year, month, 2, 10, 0],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Manchester City (H) : Additional Members 3+ Sale Registration',
            start: [year, month, 2, 10, 0],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Manchester City (H) : Additional Members 2+ Sale Registration',
            start: [year, month, 2, 10, 0],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        }
    ],
    sales: [
        {
            productId: 'lfctickets/ics',
            title: 'Brentford (H) : Additional Members Sale',
            start: [year, month, 10, 8, 15],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        },
        {
            productId: 'lfctickets/ics',
            title: 'Manchester City (H) : Additional Members 4+ Sale',
            start: [year, month, 11, 8, 15],
            duration: { minutes: 60 },
            busyStatus: 'BUSY'
        }        
    ]
};

const away: Array<ICS.EventAttributes> = [
    {
      productId: 'lfctickets/ics',
      title: 'AC Milan (A) : ST Holders and Members Sale (1+)',
      start: [year, month, 12, 10, 0],
      duration: { minutes: 60 },
      busyStatus: 'BUSY'
    },
    {
      productId: 'lfctickets/ics',
      title: 'AC Milan (A) : ST Holders and Members Registration',
      start: [year, month, 12, 13, 0],
      duration: { minutes: 60 },
      busyStatus: 'BUSY'
    },
    {
      productId: 'lfctickets/ics',
      title: 'AC Milan (A) : ST Holders and Members Sale',
      start: [year, month, 13, 8, 15],
      duration: { minutes: 60 },
      busyStatus: 'BUSY'
    },
];

const expired: Array<ICS.EventAttributes> = [
    {
        productId: 'lfctickets/ics',
        title: 'Past Event Description',
        start: [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate() - 2, 15, 30],
        duration: { minutes: 60 },
        busyStatus: 'BUSY'
    }
];

export const Mocks = {
    
    console: jest.spyOn(console, 'error'),
    events: {
        bulk: bulk,
        ams : ams,
        away: away,
        expired: expired
    }

};
Mocks.console.mockImplementation(() => null);

export default function() {

    const files: {[key: string]: string} = {
        index: fs.readFileSync('./src/__mocks__/availability-fixture-list.html', 'utf-8'),
        home: fs.readFileSync('./src/__mocks__/availability-home-active.html', 'utf-8'),
        away: fs.readFileSync('./src/__mocks__/availability-away-active.html', 'utf-8'),
        multiple: fs.readFileSync('./src/__mocks__/availability-home-multiple.html', 'utf-8'),
        bulk1: fs.readFileSync('./src/__mocks__/availability-home-bulk-1.html', 'utf-8'),
        bulk2: fs.readFileSync('./src/__mocks__/availability-home-bulk-2.html', 'utf-8'),
        credits: fs.readFileSync('./src/__mocks__/availability-home-credits.html', 'utf-8'),
        subject: fs.readFileSync('./src/__mocks__/availability-away-subject.html', 'utf-8'),
        euro: fs.readFileSync('./src/__mocks__/availability-away-euro.html', 'utf-8'),
        inactive: fs.readFileSync('./src/__mocks__/availability-home-inactive.html', 'utf-8'),
        sold: fs.readFileSync('./src/__mocks__/availability-away-inactive.html', 'utf-8')
    };
    global.fetch = jest.fn((input: RequestInfo | URL) => {
        const url: string = (input as URL).toString();
        let html: string = '';
        if ( url.endsWith('tickets-availability') ) {
            html = files.index;
        } else if ( url.includes('brentford') ) {
            html = files.home;
        } else if ( url.includes('chelsea') ) {
            html = files.multiple;
        } else if ( url.includes('brighton') ) {
            html = files.bulk1;
        } else if ( url.includes('aston-villa') ) {
            html = files.bulk2;
        } else if ( url.includes('manchester-city') ) {
            html = files.credits;
        } else if ( url.includes('wolverhampton-wanderers') ) {
            html = files.away;
        } else if ( url.includes('manchester-utd') ) {
            html = files.subject;
        } else if ( url.includes('ac-milan') ) {
            html = files.euro;
        } else if ( url.includes('nottingham-forest') ) {
            html = files.inactive;
        } else if ( url.includes('manchester-united') ) {
            html = files.sold;
        }
        return Promise.resolve({
            text: () => Promise.resolve(html)
        })
    }) as jest.Mock<typeof fetch>;  

};