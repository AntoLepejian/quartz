import { attach, detach, html, text } from 'f7k/base';
import { navigate } from 'f7k/router';
import loader from '../components/loader';
import cat from '../components/cat';
import * as fmt from '../fmt';
import busStops from './bus-stops';

export default function buses() {
    let from = 'unsw';

    let $trips, $title, $map;

    let $content = html('', {
        child: [
            html('header.header.letterbox', {
                child: [
                    $title = html('h2', {}),
                    $map = cat('button.icon-button.material-icons', 'map'),
                    html('button.icon-button.material-icons', {
                        child: text('swap_horiz'),
                        title: 'Reverse Direction',
                        onclick: e => {
                            from = from == 'unsw' ? 'central' : 'unsw';
                            reload();
                        },
                    }),
                ],
            }),
        ],
    });

    reload();
    return $content;

    function reload() {
        detach($trips);
        $trips = html('.letterbox', {});
        attach($content, $trips);

        let title = from == 'unsw'
            ? 'Bus Stops at UNSW'
            : 'Bus Stops at Central';

        $map.disabled = true;
        $map.title = title;

        $title.textContent = from == 'unsw'
            ? 'UNSW to Central'
            : 'Central to UNSW';

        loader(() => load(from), $trips, (reload, data) => {
            let [child, openMap] = loaded(title, reload, data);

            $map.disabled = false;
            $map.onclick = openMap;

            return child;
        }, failed);
    }
}

async function load(from) {
    let res = await fetch('/data/buses?from='+from);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
}

function loaded(title, reload, data) {
    let trips = [];

    for (let { legs } of data) {
        while (legs.length && legs[0].transport.kind == 'walk') legs.shift();
        while (legs.length && legs[legs.length - 1].transport.kind == 'walk') legs.pop();
        if (!legs.length) continue;

        let route = [];
        for (let i = 0; i < legs.length; i++) {
            let { transport } = legs[i];

            if (i > 0) route.push(' › ');

            switch (transport.kind) {
                case 'walk':
                    route.push(icon('directions_walk'));
                    break;
                case 'bus':
                    route.push(icon('directions_bus'), ' ', cat('span', transport.name));
                    break;
                default:
                    route.push('???');
            }
        }

        trips.push({
            start: new Date(legs[0].departure * 1000),
            end: new Date(legs[legs.length - 1].arrival * 1000),
            route: cat('span.buses-route', ...route),
            stops: legs.map(x => x.source),
        });
    }

    trips.sort((a, b) => a.start - b.start);

    //TODO: Use a more intelligent filter.
    if (trips.some(trip => trip.stops.length == 1)) {
        trips = trips.filter(trip => trip.stops.length == 1);
    }

    let items = trips.map(trip => {
        let $min, $trip, token;

        $trip = html('.buses-trip', {
            destroy() {
                clearInterval(token);
            },
            child: [
                html('.buses-countdown', {
                    child: [
                        $min = cat('span'),
                        text('min'),
                    ],
                }),
                html('.buses-detail', {
                    child: [
                        trip.route,
                        cat('small', fmt.interval(trip.start, trip.end)),
                        ...trip.stops.map(stop => cat('small', stop.name)),
                    ],
                }),
            ],
        });

        let dt = trip.start - Date.now();
        if (dt < 0) return;
        else $min.textContent = dt / 60000 | 0;
        token = setInterval(() => {
            let dt = trip.start - Date.now();
            if (dt < 0) detach($trip);
            else $min.textContent = dt / 60000 | 0;
        }, 1000);

        return $trip;
    });

    let places = {};
    for (let trip of trips) {
    for (let i = 0; i < trip.stops.length; i++) {
        let { name, coords } = trip.stops[i];

        if (!places.hasOwnProperty(name)) {
            places[name] = { coords, center: false };
        }

        if (i == 0) {
            places[name].center = true;
        }
    }}

    function openMap() {
        busStops(title, places);
    }

    return [items, openMap];
}

function icon(s) {
    return cat('span.material-icons', s);
}

function failed(reload) {
    let msg = navigator.onLine
        ? 'We couldn\'t load the trip list.'
        : 'It looks like you\'re offline.';

    return [
        text(msg + ' '),
        html('a', {
            child: text('Try again?'),
            href: '#',
            onclick: e => {
                e.preventDefault();
                reload();
            },
        }),
    ];
}
