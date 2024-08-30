# LFC Ticket Parser

Utility to read in the [**Liverpool Football Club** Tickets Availability](https://www.liverpoolfc.com/tickets/tickets-availability) page, retrieve sales dates for fixtures and email them out in [iCalendar](https://icalendar.org/) format.

_Please note: this does not parse ambulatory or hospitality seating, and will not return any currently active sales (that ship has sailed)._

## Usage

Before running the parse, you will need to configure it using environment variables.

### Example .env file

The following properties tell the parser where to retrieve the index page from, and the domain will be used for all the relative links representing the inidividual fixture pages:

```properties
DOMAIN=https://www.liverpoolfc.com
INDEX_URL=/tickets/tickets-availability
```

The parser will attempt to email the generated ICS file via SMTP after processing, and these properties are required in order for it to be able to do so (`EMAIL_PORT` and `EMAIL_SECURE` can be amended if you wish to communicate with your mail server insecurely):

```properties
EMAIL_HOST=<SMTP Server Hostname>
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=<SMTP Account Username>
EMAIL_PASS=<SMTP Account Password>
EMAIL_FROM=LFC Ticket Parser<SMTP Account Email Address>
EMAIL_TO=<Recipient Email Address>
```

In order for the parser to determine whether fixture details have changed, it needs to store details somewhere to refer back to.  Presently, the only database supported is [AWS DynamoDB](https://aws.amazon.com/dynamodb/), and you will need the following properties to communicate with it:

```properties
DB_CLIENT=DynamoDB
DB_TABLE=<Table Name>
```

The following properties are only needed if you run the parser remotely from where the database is hosted:

```properties
AWS_ACCESS_KEY_ID=<IAM User Access Key>
AWS_SECRET_ACCESS_KEY=<IAM User Secret Access Key>
AWS_REGION=<Region DB is Hosted>
```

If no database is configured, the parser will not fail, it will still parse the website and send out the email but it will send out all fixture details every time.

### Running locally

Once configured, to run it locally from within a [Node](https://nodejs.org/en) environment, you only need to run the following command:

```bash
npm run start
```

### Running as an AWS Lambda

If you wish to run it as an [AWS Lambda](https://aws.amazon.com/lambda/) service, then you need to follow these steps:

1. Compile the Javascript code:
```bash
npm run build
```
2. Copy the contents of the `dist` folder outside of the project file structure
3. From within this new folder, install the necessary dependencies:
```bash
npm install dotenv
npm install ics
npm install nodemailer
```
4. Zip up the contents of the new folder
5. Create your new Lambda service
6. In the content editor, upload the zip file
7. Edit `index.js` - replace `TicketParser.parse();`
        with
```javascript
module.exports.handler = async (event) => {
    await TicketParser.parse();
};
```
8. Be sure to setup the environment variables above, within Configuration > Environment Variables

You can then run this [Lambda](https://aws.amazon.com/lambda/) through whichever method you choose (for example, an [EventBridge](https://aws.amazon.com/eventbridge/) schedule).

## Future Plans

If time permits, I may add more configuration to allow you to restrict which fixtures it returns (e.g. do not parse away fixtures, fixtures that require _x_ credits, etc.)