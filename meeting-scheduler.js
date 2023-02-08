const moment = require("moment");
const {exec} = require("child_process");

const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const open = require('open');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

const loadSavedCredentialsIfExist = async () => {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

const saveCredentials = async (client) => {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

const authorize = async () => {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

const getMeetings = async (auth) => {
    const calendar = google.calendar({version: 'v3', auth});
    const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        timeMax: new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
    });
    exec(`say Hello Vikram, You have ${res.data.items.length} meetings today`);
    return res.data.items;
}

const amITheCreator = (meet) => meet.creator.self;

const didIAcceptTheInvite = (meet) => meet.attendees
    .filter(attendee => attendee.self)[0].responseStatus === 'accepted';

const scheduleJobToOpenMeetings = (meetings) => {
    meetings
        .filter(meet => amITheCreator(meet) || didIAcceptTheInvite(meet))
        .forEach(meet => {
            console.log(meet.summary);
            const meetingTime = moment(meet.start.dateTime);
            const currentTime = moment.now();
            const timeDiff = meetingTime.diff(currentTime)
            const timeLeftToMeet = moment.duration(timeDiff).asMilliseconds();
            setTimeout(() => {
                exec(`say ${meet.summary} is about to start`);
                open(meet.htmlLink)
            }, timeLeftToMeet - 2000)
        })
}

const main = async () => {
    const auth = await authorize();
    const meetings = await getMeetings(auth);
    scheduleJobToOpenMeetings(meetings);
}

main();
