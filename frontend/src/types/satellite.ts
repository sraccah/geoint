export interface SatelliteGP {
    OBJECT_NAME: string;
    OBJECT_ID: string;
    NORAD_CAT_ID: number;
    EPOCH: string;
    MEAN_MOTION: number;
    ECCENTRICITY: number;
    INCLINATION: number;
    RA_OF_ASC_NODE: number;
    ARG_OF_PERICENTER: number;
    MEAN_ANOMALY: number;
    BSTAR: number;
    MEAN_MOTION_DOT: number;
    MEAN_MOTION_DDOT: number;
    CLASSIFICATION_TYPE: string;
    REV_AT_EPOCH: number;
    ELEMENT_SET_NO?: number;
}

export interface SatelliteGroupDef {
    id: string;
    label: string;
    color: string;
    icon: string;
    description: string;
}
