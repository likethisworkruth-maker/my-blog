function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var redirects = {
        '/problems/': '/',
        '/problems/vaccine-schedule-sharing/': '/logs/002-vaccine/',
        '/answer/vaccine-schedule-sharing/': '/naraibase/answer/',
        '/answer/edit/': '/',
        '/results/vaccine-schedule-sharing/': '/',
        '/methods/': '/apps/',
        '/methods/family-verbal-reminder/': '/logs/002-vaccine/',
        '/methods/paper-calendar/': '/logs/002-vaccine/',
        '/methods/google-calendar/': '/apps/',
        '/methods/timetree/': '/apps/',
        '/methods/line-message/': '/apps/',
        '/checklists/': '/knowhow/',
        '/checklists/night-memo/': '/knowhow/001-night-memo/',
        '/checklists/family-log/': '/knowhow/002-family-log/'
    };

    if (redirects[uri]) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                location: { value: redirects[uri] },
                'cache-control': { value: 'public, max-age=3600' }
            }
        };
    }

    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }
    return request;
}
