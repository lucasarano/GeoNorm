export const DEPARTAMENTOS = [
  'Asunción',
  'Central',
  'Alto Paraná',
  'Itapúa',
  'Cordillera',
  'Guairá',
  'Caaguazú',
  'Caazapá',
  'Misiones',
  'Paraguarí',
  'Alto Paraguay',
  'Boquerón',
  'Amambay',
  'Canindeyú',
  'Presidente Hayes',
  'Concepción',
  'Ñeembucú'
];

export const CITY_BY_DEPARTMENT = {
  'Asunción': ['Asunción'],
  'Central': [
    'Asunción (Metro)',
    'Lambaré',
    'San Lorenzo',
    'Capiatá',
    'Luque',
    'Villa Elisa',
    'Ñemby',
    'Itauguá',
    'Limpio',
    'Areguá',
    'Mariano Roque Alonso',
    'Guarambaré',
    'San Antonio',
    'Itá',
    'Fernando de la Mora',
    'Ypane',
    'Ypacaraí',
    'J. Augusto Saldívar',
    'Villeta',
    'Nueva Italia',
    'Juan de Mena',
    'Arroyos y Esteros',
    'Isla Pucú',
    'Emboscada',
    'San Bernardino',
    'Atyrá'
  ],
  'Alto Paraná': [
    'Ciudad del Este',
    'Hernandarias',
    'Presidente Franco',
    'Los Cedrales',
    'Minga Guazú',
    'Juan León Mallorquín',
    'Itakyry',
    'Iruña',
    'Mbaracayú',
    'Naranjal',
    'Ñacunday',
    'San Alberto',
    'Santa Fe del Paraná',
    'Santa Rita',
    'Tavapy'
  ],
  'Itapúa': [
    'Encarnación',
    'Cambyretá',
    'Capitán Meza',
    'Carlos Antonio López',
    'Hohenau',
    'Bella Vista',
    'Obligado',
    'Tomás Romero Pereira',
    'Fram',
    'Coronel Bogado',
    'General Artigas',
    'Pirapó',
    'Edelira',
    'La Paz',
    'Natalio',
    'Yatytay'
  ],
  'Cordillera': [
    'Caacupé',
    'San Bernardino',
    'Piribebuy',
    'Eusebio Ayala',
    'Itacurubí de la Cordillera',
    'Emboscada',
    'Valenzuela',
    'Nueva Colombia',
    'Caraguatay',
    'Altos'
  ],
  'Guairá': [
    'Villarrica',
    'Colonia Independencia',
    'Iturbe',
    'Mbocayaty',
    'Paso Yobai',
    'Borja',
    'Eugenio A. Garay'
  ],
  'Caaguazú': [
    'Coronel Oviedo',
    'Caaguazú',
    'Repatriación',
    'Dr. Juan Manuel Frutos',
    'Tembiaporá',
    'Nueva Londres',
    'Raúl Arsenio Oviedo',
    'San José de los Arroyos'
  ],
  'Caazapá': [
    'Caazapá',
    'San Juan Nepomuceno',
    'Abaí',
    'Maciel',
    'Yuty',
    'Colonias Unidas'
  ],
  'Misiones': [
    'San Juan Bautista',
    'Ayolas',
    'San Ignacio',
    'Santa Rosa',
    'Santiago',
    'San Miguel',
    'Villa Florida',
    'Yabebyry'
  ],
  'Paraguarí': [
    'Paraguarí',
    'Carapeguá',
    'Quiindy',
    'Ybycuí',
    'Sapucai',
    'San Roque González de Santa Cruz',
    'Pirayú',
    'La Colmena'
  ],
  'Alto Paraguay': [
    'Fuerte Olimpo',
    'Bahía Negra',
    'Puerto Casado',
    'Carmelo Peralta'
  ],
  'Boquerón': [
    'Filadelfia',
    'Loma Plata',
    'Neuland',
    'Mariscal Estigarribia'
  ],
  'Amambay': [
    'Pedro Juan Caballero',
    'Bella Vista Norte',
    'Capitán Bado',
    'Zanja Pytá'
  ],
  'Canindeyú': [
    'Salto del Guairá',
    'Curuguaty',
    'Katueté',
    'Ypejhú',
    'Ybyrarovaná',
    'La Paloma',
    'Corpus Christi'
  ],
  'Presidente Hayes': [
    'Villa Hayes',
    'Benjamín Aceval',
    'Nanawa',
    'Pozo Colorado'
  ],
  'Concepción': [
    'Concepción',
    'Horqueta',
    'Loreto',
    'San Lázaro',
    'Belén',
    'Yby Yaú',
    'Azotey'
  ],
  'Ñeembucú': [
    'Pilar',
    'Isla Umbú',
    'Humaitá',
    'Guazú Cuá',
    'Desmochados'
  ]
};

export const DEPARTMENT_SYNONYMS = {
  'capital': 'Asunción',
  'asuncion': 'Asunción',
  'asuncion capital': 'Asunción',
  'gran asuncion': 'Central',
  'departamento central': 'Central',
  'alto parana py': 'Alto Paraná',
  'alto parana paraguay': 'Alto Paraná',
  'alto parana': 'Alto Paraná',
  'itapua': 'Itapúa',
  'caaguazu': 'Caaguazú',
  'guaira': 'Guairá',
  'paraguay': '',
  'na': '',
  'n/a': '',
  'other': '',
  'otros': '',
  'ninguno': '',
  'central py': 'Central'
};

export const CITY_SYNONYMS = {
  'asuncion': 'Asunción',
  'ciudad de asuncion': 'Asunción',
  'san lorenzo py': 'San Lorenzo',
  'ciudad del este': 'Ciudad del Este',
  'cde': 'Ciudad del Este',
  'encarnacion': 'Encarnación',
  'villarrica del espiritu santo': 'Villarrica',
  'nemby': 'Ñemby',
  'nemby py': 'Ñemby',
  'lambare': 'Lambaré',
  'capiata': 'Capiatá',
  'ypane': 'Ypané',
  'benjamin aceval': 'Benjamín Aceval',
  'san bernardino': 'San Bernardino',
  'san ignacio guazu': 'San Ignacio'
};

export const ACCENT_FIXES = {
  'asuncion': 'Asunción',
  'itapua': 'Itapúa',
  'guaira': 'Guairá',
  'caaguazu': 'Caaguazú',
  'capiata': 'Capiatá',
  'nemby': 'Ñemby',
  'ypane': 'Ypané',
  'colon': 'Colón',
  'pilar': 'Pilar',
  'ciudad': 'Ciudad',
  'ruta': 'Ruta',
  'senador': 'Senador',
  'doctor': 'Doctor',
  'general': 'General',
  'teniente': 'Teniente',
  'capitan': 'Capitán'
};

export const ADDRESS_ABBREVIATION_MAP = {
  av: 'Avenida',
  avda: 'Avenida',
  gral: 'General',
  pte: 'Presidente',
  tte: 'Teniente',
  mcal: 'Mariscal',
  cnel: 'Coronel',
  cap: 'Capitán',
  ing: 'Ingeniero',
  sta: 'Santa',
  sto: 'Santo',
  n: 'N°',
  no: 'N°',
  'n°': 'N°',
  flia: 'Familia'
};

export const TITLECASE_STOPWORDS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el', 'e']);

export const ADDRESS_NOISE_PATTERNS = [
  /\b(paraguay|contacto|correo|mail|email)\b/gi,
  /\b(na|n\/a|s\.a\.|sociedad an[oó]nima)\b/gi,
  /\b(sin dato|sin datos|sin direccion)\b/gi,
  /\b(p\.o\.? box\.?|casilla de correo)\b/gi
];

export const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export const PHONE_TOKEN_REGEX = /(?:(?:\+?595|0)?\d[\d\s.-]{5,}\d)/g;

export const ROUTE_REGEX = /\bruta\s*(?:py\s*-?\s*)?(\d{1,3})\b/gi;

export const CITY_TO_DEPARTMENT = Object.fromEntries(
  Object.entries(CITY_BY_DEPARTMENT).flatMap(([dept, cities]) =>
    cities.map(city => [city, dept])
  )
);
