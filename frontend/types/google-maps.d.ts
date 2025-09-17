declare global {
    interface Window {
        google: typeof google;
    }
}

declare namespace google {
    namespace maps {
        class Map {
            constructor(mapDiv: Element | null, opts?: MapOptions);
        }

        class Marker {
            constructor(opts?: MarkerOptions);
            addListener(eventName: string, handler: Function): void;
            getPosition(): LatLng | undefined;
        }

        namespace marker {
            class AdvancedMarkerElement {
                constructor(opts?: AdvancedMarkerElementOptions);
                addListener(eventName: string, handler: Function): void;
                position: LatLngLiteral | LatLng;
                map: Map | null;
                content: HTMLElement;
                gmpDraggable: boolean;
            }
        }

        class LatLng {
            constructor(lat: number, lng: number);
            lat(): number;
            lng(): number;
        }

        class Size {
            constructor(width: number, height: number);
        }

        class Point {
            constructor(x: number, y: number);
        }

        interface MapOptions {
            center?: LatLngLiteral;
            zoom?: number;
            mapTypeId?: MapTypeId;
            streetViewControl?: boolean;
            mapTypeControl?: boolean;
            fullscreenControl?: boolean;
        }

        interface MarkerOptions {
            position?: LatLngLiteral;
            map?: Map;
            draggable?: boolean;
            title?: string;
            icon?: string | Icon;
        }

        interface AdvancedMarkerElementOptions {
            position?: LatLngLiteral;
            map?: Map;
            content?: HTMLElement;
            gmpDraggable?: boolean;
            title?: string;
        }

        interface Icon {
            url: string;
            scaledSize?: Size;
            anchor?: Point;
        }

        interface LatLngLiteral {
            lat: number;
            lng: number;
        }

        enum MapTypeId {
            ROADMAP = 'roadmap',
            SATELLITE = 'satellite',
            HYBRID = 'hybrid',
            TERRAIN = 'terrain'
        }
    }
}

export { };
