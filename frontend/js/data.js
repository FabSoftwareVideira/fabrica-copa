// =====================================================
// DATA - Álbum Copa do Mundo FIFA 2026
// =====================================================

const ALBUM_DATA = {
    title: "Copa do Mundo FIFA 2026",
    subtitle: "EUA • Canadá • México",
    totalExpected: 298,

    // Seção de figurinhas especiais
    special: {
        id: "especial",
        name: "Especial",
        color: "#FFD700",
        stickers: [
            { num: 1, name: "Capa do Álbum", type: "cover", icon: "📖", image: "public/specials/especial_capa.webp" },
            { num: 2, name: "Troféu FIFA World Cup", type: "trophy", icon: "🏆", image: "public/specials/especial_trophy.webp" },
            { num: 3, name: "Talisma Oficial", type: "mascot", icon: "🎭", image: "public/specials/especial_mascot.webp" },
            { num: 4, name: "Bola Oficial", type: "ball", icon: "⚽", image: "public/specials/especial_ball.webp" },
            { num: 5, name: "Sede: Nova York / NJ", type: "stadium", icon: "🏟️", image: "public/specials/especial_stadium_ny.webp" },
            { num: 6, name: "Sede: Los Angeles", type: "stadium", icon: "🏟️", image: "public/specials/especial_stadium_la.webp" },
            { num: 7, name: "Sede: Dallas", type: "stadium", icon: "🏟️", image: "public/specials/especial_stadium_dallas.webp" },
            { num: 8, name: "Sede: Cidade do México", type: "stadium", icon: "🏟️", image: "public/specials/especial_stadium_mexico.webp" },
            { num: 9, name: "Sede: Toronto", type: "stadium", icon: "🏟️", image: "public/specials/especial_stadium_toronto.webp" },
            { num: 10, name: "Sede: Vancouver", type: "stadium", icon: "🏟️", image: "public/specials/especial_stadium_vancouver.webp" },
        ]
    },

    // Grupos e times
    groups: [
        {
            "id": "A",
            "name": "Grupo A",
            "color": "#e74c3c",
            "startNum": 11,
            "teams": [
                {
                    "id": "mex",
                    "name": "México",
                    "flag": "🇲🇽",
                    "abbr": "MEX",
                    "players": ["Hirving Lozano", "Edson Álvarez", "Santiago Giménez", "Guillermo Ochoa", "Luis Chávez", "César Montes", "Johan Vásquez", "Orbelín Pineda", "Uriel Antuna", "Julián Quiñones"]
                },
                {
                    "id": "rsa",
                    "name": "África do Sul",
                    "flag": "🇿🇦",
                    "abbr": "RSA",
                    "players": ["Percy Tau", "Teboho Mokoena", "Ronwen Williams", "Lyle Foster", "Themba Zwane", "Khuliso Mudau", "Mothobi Mvala", "Aubrey Modiba", "Evidence Makgopa", "Thapelo Morena"]
                },
                {
                    "id": "kor",
                    "name": "Coreia do Sul",
                    "flag": "🇰🇷",
                    "abbr": "KOR",
                    "players": ["Heung-min Son", "Min-jae Kim", "Kang-in Lee", "Hee-chan Hwang", "Jae-sung Lee", "Gue-sung Cho", "In-beom Hwang", "Young-woo Seol", "Seung-gyu Kim", "Seung-ho Paik"]
                },
                {
                    "id": "cze",
                    "name": "República Tcheca",
                    "flag": "🇨🇿",
                    "abbr": "CZE",
                    "players": ["Patrik Schick", "Tomas Soucek", "Tomas Holes", "Vladimir Coufal", "Adam Hlozek", "Jindrich Stanek", "Ladislav Krejci", "David Jurasek", "Vaclav Cerny", "Jan Kuchta"]
                }
            ]
        },
        {
            "id": "B",
            "name": "Grupo B",
            "color": "#e67e22",
            "startNum": 37,
            "teams": [
                {
                    "id": "can",
                    "name": "Canadá",
                    "flag": "🇨🇦",
                    "abbr": "CAN",
                    "players": ["Alphonso Davies", "Jonathan David", "Tajon Buchanan", "Cyle Larin", "Stephen Eustáquio", "Ismaël Koné", "Alistair Johnston", "Kamal Miller", "Jonathan Osorio", "Dayne St. Clair"]
                },
                {
                    "id": "bih",
                    "name": "Bósnia e Herzegovina",
                    "flag": "🇧🇦",
                    "abbr": "BIH",
                    "players": ["Edin Dzeko", "Sead Kolasinac", "Amar Dedic", "Anel Ahmedhodzic", "Ermedin Demirovic", "Rade Krunic", "Benjamin Tahirovic", "Dennis Hadzikadunic", "Jusuf Gazibegovic", "Nikola Vasilj"]
                },
                {
                    "id": "qat",
                    "name": "Catar",
                    "flag": "🇶🇦",
                    "abbr": "QAT",
                    "players": ["Akram Afif", "Almoez Ali", "Hassan Al-Haydos", "Meshaal Barsham", "Lucas Mendes", "Boualem Khoukhi", "Pedro Miguel", "Mohammed Waad", "Tarek Salman", "Abdulaziz Hatem"]
                },
                {
                    "id": "sui",
                    "name": "Suíça",
                    "flag": "🇨🇭",
                    "abbr": "SUI",
                    "players": ["Granit Xhaka", "Xherdan Shaqiri", "Yann Sommer", "Manuel Akanji", "Rubén Vargas", "Gregor Kobel", "Breel Embolo", "Denis Zakaria", "Remo Freuler", "Zeki Amdouni"]
                }
            ]
        },
        {
            "id": "C",
            "name": "Grupo C",
            "color": "#f1c40f",
            "startNum": 63,
            "teams": [
                {
                    "id": "bra",
                    "name": "Brasil",
                    "flag": "🇧🇷",
                    "abbr": "BRA",
                    "players": ["Vinícius Junior", "Rodrygo", "Endrick", "Bruno Guimarães", "Lucas Paquetá", "Marquinhos", "Gabriel Magalhães", "Alisson", "Éder Militão", "Savinho"]
                },
                {
                    "id": "mar",
                    "name": "Marrocos",
                    "flag": "🇲🇦",
                    "abbr": "MAR",
                    "players": ["Achraf Hakimi", "Brahim Díaz", "Youssef En-Nesyri", "Sofyan Amrabat", "Bono", "Azzedine Ounahi", "Nayef Aguerd", "Hakim Ziyech", "Abde Ezzalzouli", "Amine Adli"]
                },
                {
                    "id": "hai",
                    "name": "Haiti",
                    "flag": "🇭🇹",
                    "abbr": "HAI",
                    "players": ["Frantzdy Pierrot", "Duckens Nazon", "Danley Jean Jacques", "Carlens Arcus", "Garissone Innocent", "Ricardo Adé", "Wilde-Donald Guerrier", "Derrick Etienne Jr.", "Mondesir Prunier", "Bryan Alceus"]
                },
                {
                    "id": "sco",
                    "name": "Escócia",
                    "flag": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
                    "abbr": "SCO",
                    "players": ["Andy Robertson", "Scott McTominay", "John McGinn", "Billy Gilmour", "Kieran Tierney", "Lewis Ferguson", "Che Adams", "Angus Gunn", "Nathan Patterson", "Ryan Christie"]
                }
            ]
        },
        {
            "id": "D",
            "name": "Grupo D",
            "color": "#2ecc71",
            "startNum": 89,
            "teams": [
                {
                    "id": "usa",
                    "name": "Estados Unidos",
                    "flag": "🇺🇸",
                    "abbr": "EUA",
                    "players": ["Christian Pulisic", "Tyler Adams", "Weston McKennie", "Gio Reyna", "Matt Turner", "Folarin Balogun", "Yunus Musah", "Antonee Robinson", "Sergiño Dest", "Timothy Weah"]
                },
                {
                    "id": "par",
                    "name": "Paraguai",
                    "flag": "🇵🇾",
                    "abbr": "PAR",
                    "players": ["Miguel Almirón", "Julio Enciso", "Gustavo Gómez", "Omar Alderete", "Mathías Villasanti", "Antonio Sanabria", "Ramón Sosa", "Junior Alonso", "Carlos Coronel", "Diego Gómez"]
                },
                {
                    "id": "aus",
                    "name": "Austrália",
                    "flag": "🇦🇺",
                    "abbr": "AUS",
                    "players": ["Mat Ryan", "Harry Souttar", "Jackson Irvine", "Mitchell Duke", "Craig Goodwin", "Nestory Irankunda", "Connor Metcalfe", "Jordan Bos", "Keanu Baccus", "Alessandro Circati"]
                },
                {
                    "id": "tur",
                    "name": "Turquia",
                    "flag": "🇹🇷",
                    "abbr": "TUR",
                    "players": ["Arda Güler", "Hakan Çalhanoğlu", "Kenan Yıldız", "Ferdi Kadıoğlu", "Orkun Kökçü", "Barış Alper Yılmaz", "Kerem Aktürkoğlu", "Merih Demiral", "Çağlar Söyüncü", "Mert Günok"]
                }
            ]
        },
        {
            "id": "E",
            "name": "Grupo E",
            "color": "#1abc9c",
            "startNum": 115,
            "teams": [
                {
                    "id": "ger",
                    "name": "Alemanha",
                    "flag": "🇩🇪",
                    "abbr": "GER",
                    "players": ["Florian Wirtz", "Jamal Musiala", "Kai Havertz", "Leroy Sané", "Joshua Kimmich", "Antonio Rüdiger", "Jonathan Tah", "Marc-André ter Stegen", "Niclas Füllkrug", "Aleksandar Pavlović"]
                },
                {
                    "id": "cuw",
                    "name": "Curaçao",
                    "flag": "🇨🇼",
                    "abbr": "CUW",
                    "players": ["Leandro Bacuna", "Juninho Bacuna", "Eloy Room", "Roshon van Eijma", "Vurnon Anita", "Jearl Margaritha", "Kenji Gorré", "Brandley Kuwas", "Gervane Kastaneer", "Rangelo Janga"]
                },
                {
                    "id": "civ",
                    "name": "Costa do Marfim",
                    "flag": "🇨🇮",
                    "abbr": "CIV",
                    "players": ["Sébastien Haller", "Franck Kessié", "Simon Adingra", "Ousmane Diomande", "Ibrahim Sangaré", "Evan Ndicka", "Seko Fofana", "Odilon Kossounou", "Yahia Fofana", "Wilfried Singo"]
                },
                {
                    "id": "ecu",
                    "name": "Equador",
                    "flag": "🇪🇨",
                    "abbr": "ECU",
                    "players": ["Moisés Caicedo", "Pervis Estupiñán", "Enner Valencia", "Piero Hincapié", "Kendry Páez", "Willian Pacho", "Angelo Preciado", "Jeremy Sarmiento", "Kevin Rodríguez", "Hernán Galíndez"]
                }
            ]
        },
        {
            "id": "F",
            "name": "Grupo F",
            "color": "#3498db",
            "startNum": 141,
            "teams": [
                {
                    "id": "ned",
                    "name": "Países Baixos",
                    "flag": "🇳🇱",
                    "abbr": "NED",
                    "players": ["Virgil van Dijk", "Frenkie de Jong", "Cody Gakpo", "Xavi Simons", "Jeremie Frimpong", "Micky van de Ven", "Nathan Aké", "Tijjani Reijnders", "Donyell Malen", "Bart Verbruggen"]
                },
                {
                    "id": "jpn",
                    "name": "Japão",
                    "flag": "🇯🇵",
                    "abbr": "JPN",
                    "players": ["Takefusa Kubo", "Kaoru Mitoma", "Wataru Endo", "Takehiro Tomiyasu", "Ritsu Doan", "Hidemasa Morita", "Ayase Ueda", "Keito Nakamura", "Hiroki Ito", "Zion Suzuki"]
                },
                {
                    "id": "swe",
                    "name": "Suécia",
                    "flag": "🇸🇪",
                    "abbr": "SWE",
                    "players": ["Viktor Gyökeres", "Alexander Isak", "Dejan Kulusevski", "Anthony Elanga", "Victor Lindelöf", "Ludwig Augustinsson", "Robin Olsen", "Emil Forsberg", "Hugo Larsson", "Carl Starfelt"]
                },
                {
                    "id": "tun",
                    "name": "Tunísia",
                    "flag": "🇹🇳",
                    "abbr": "TUN",
                    "players": ["Ellyes Skhiri", "Aissa Laidouni", "Montassar Talbi", "Youssef Msakni", "Ali Abdi", "Sayfallah Ltaief", "Aymen Dahmen", "Hamza Rafia", "Elias Achouri", "Wajdi Kechrida"]
                }
            ]
        },
        {
            "id": "G",
            "name": "Grupo G",
            "color": "#9b59b6",
            "startNum": 167,
            "teams": [
                {
                    "id": "bel",
                    "name": "Bélgica",
                    "flag": "🇧🇪",
                    "abbr": "BEL",
                    "players": ["Kevin De Bruyne", "Jeremy Doku", "Amadou Onana", "Lois Openda", "Leandro Trossard", "Johan Bakayoko", "Wout Faes", "Timothy Castagne", "Arthur Theate", "Koen Casteels"]
                },
                {
                    "id": "egy",
                    "name": "Egito",
                    "flag": "🇪🇬",
                    "abbr": "EGY",
                    "players": ["Mohamed Salah", "Omar Marmoush", "Mostafa Mohamed", "Trezeguet", "Mohamed Elneny", "Emam Ashour", "Ahmed Hegazi", "Mohamed Abdelmonem", "Hamdy Fathy", "Mohamed El Shenawy"]
                },
                {
                    "id": "irn",
                    "name": "Irã",
                    "flag": "🇮🇷",
                    "abbr": "IRN",
                    "players": ["Mehdi Taremi", "Sardar Azmoun", "Alireza Jahanbakhsh", "Saman Ghoddos", "Mehdi Ghayedi", "Saeed Ezatolahi", "Milad Mohammadi", "Hossein Kanaanizadegan", "Ramin Rezaeian", "Alireza Beiranvand"]
                },
                {
                    "id": "nzl",
                    "name": "Nova Zelândia",
                    "flag": "🇳🇿",
                    "abbr": "NZL",
                    "players": ["Chris Wood", "Liberato Cacace", "Sarpreet Singh", "Joe Bell", "Marko Stamenic", "Matthew Garbett", "Ben Waine", "Tyler Bindon", "Nando Pijnaker", "Alex Paulsen"]
                }
            ]
        },
        {
            "id": "H",
            "name": "Grupo H",
            "color": "#e91e63",
            "startNum": 193,
            "teams": [
                {
                    "id": "esp",
                    "name": "Espanha",
                    "flag": "🇪🇸",
                    "abbr": "ESP",
                    "players": ["Lamine Yamal", "Pedri", "Gavi", "Rodri", "Nico Williams", "Dani Olmo", "Pau Cubarsí", "Álex Grimaldo", "Daniel Carvajal", "Unai Simón"]
                },
                {
                    "id": "cpv",
                    "name": "Cabo Verde",
                    "flag": "🇨🇻",
                    "abbr": "CPV",
                    "players": ["Ryan Mendes", "Logan Costa", "Garry Rodrigues", "Jovane Cabral", "Bebé", "Patrick Andrade", "Roberto Lopes", "Deroy Duarte", "Vozinha", "Steven Moreira"]
                },
                {
                    "id": "ksa",
                    "name": "Arábia Saudita",
                    "flag": "🇸🇦",
                    "abbr": "KSA",
                    "players": ["Salem Al-Dawsari", "Mohammed Al-Owais", "Firas Al-Buraikan", "Sami Al-Najei", "Ali Al-Bulayhi", "Saud Abdulhamid", "Abdulelah Al-Malki", "Mohamed Kanno", "Hassan Tambakti", "Abdulrahman Ghareeb"]
                },
                {
                    "id": "uru",
                    "name": "Uruguai",
                    "flag": "🇺🇾",
                    "abbr": "URU",
                    "players": ["Federico Valverde", "Darwin Núñez", "Facundo Pellistri", "Manuel Ugarte", "Nicolás de la Cruz", "Ronald Araújo", "Mathías Olivera", "José María Giménez", "Sergio Rochet", "Luciano Rodríguez"]
                }
            ]
        },
        {
            "id": "I",
            "name": "Grupo I",
            "color": "#00bcd4",
            "startNum": 219,
            "teams": [
                {
                    "id": "fra",
                    "name": "França",
                    "flag": "🇫🇷",
                    "abbr": "FRA",
                    "players": ["Kylian Mbappé", "Antoine Griezmann", "Eduardo Camavinga", "Aurélien Tchouaméni", "William Saliba", "Ousmane Dembélé", "Mike Maignan", "Warren Zaïre-Emery", "Theo Hernández", "Bradley Barcola"]
                },
                {
                    "id": "sen",
                    "name": "Senegal",
                    "flag": "🇸🇳",
                    "abbr": "SEN",
                    "players": ["Sadio Mané", "Édouard Mendy", "Kalidou Koulibaly", "Idrissa Gueye", "Ismaïla Sarr", "Nicolas Jackson", "Pape Matar Sarr", "Lamine Camara", "Abdou Diallo", "Iliman Ndiaye"]
                },
                {
                    "id": "irq",
                    "name": "Iraque",
                    "flag": "🇮🇶",
                    "abbr": "IRQ",
                    "players": ["Aymen Hussein", "Ali Jasim", "Zidane Iqbal", "Ibrahim Bayesh", "Amir Al-Ammari", "Youssef Amyn", "Saad Natiq", "Rebin Sulaka", "Hussein Ali", "Jalal Hassan"]
                },
                {
                    "id": "nor",
                    "name": "Noruega",
                    "flag": "🇳🇴",
                    "abbr": "NOR",
                    "players": ["Erling Haaland", "Martin Ødegaard", "Antonio Nusa", "Alexander Sørloth", "Oscar Bobb", "Julian Ryerson", "Sander Berge", "Leo Østigård", "Kristoffer Ajer", "Ørjan Nyland"]
                }
            ]
        },
        {
            "id": "J",
            "name": "Grupo J",
            "color": "#ff5722",
            "startNum": 245,
            "teams": [
                {
                    "id": "arg",
                    "name": "Argentina",
                    "flag": "🇦🇷",
                    "abbr": "ARG",
                    "players": ["Lionel Messi", "Julián Álvarez", "Enzo Fernández", "Alexis Mac Allister", "Lautaro Martínez", "Rodrigo De Paul", "Cristian Romero", "Emiliano Martínez", "Alejandro Garnacho", "Lisandro Martínez"]
                },
                {
                    "id": "dza",
                    "name": "Argélia",
                    "flag": "🇩🇿",
                    "abbr": "DZA",
                    "players": ["Riyad Mahrez", "Ismaël Bennacer", "Rayan Aït-Nouri", "Mohamed Amoura", "Farès Chaïbi", "Amine Gouiri", "Said Benrahma", "Aissa Mandi", "Anthony Mandrea", "Houssem Aouar"]
                },
                {
                    "id": "aut",
                    "name": "Áustria",
                    "flag": "🇦🇹",
                    "abbr": "AUT",
                    "players": ["David Alaba", "Marcel Sabitzer", "Konrad Laimer", "Christoph Baumgartner", "Nicolas Seiwald", "Xaver Schlager", "Kevin Danso", "Michael Gregoritsch", "Patrick Wimmer", "Alexander Schlager"]
                },
                {
                    "id": "jor",
                    "name": "Jordânia",
                    "flag": "🇯🇴",
                    "abbr": "JOR",
                    "players": ["Mousa Tamari", "Yazan Al-Naimat", "Ali Olwan", "Noor Al-Rawabdeh", "Nizar Al-Rashdan", "Yazeed Abulaila", "Abdallah Nasib", "Ehsan Haddad", "Salem Al-Ajalin", "Mahmoud Al-Mardi"]
                }
            ]
        },
        {
            "id": "K",
            "name": "Grupo K",
            "color": "#607d8b",
            "startNum": 271,
            "teams": [
                {
                    "id": "por",
                    "name": "Portugal",
                    "flag": "🇵🇹",
                    "abbr": "POR",
                    "players": ["Cristiano Ronaldo", "Bruno Fernandes", "Rafael Leão", "Bernardo Silva", "João Neves", "Vitinha", "Rúben Dias", "João Cancelo", "Gonçalo Inácio", "Diogo Costa"]
                },
                {
                    "id": "cod",
                    "name": "República Democrática do Congo",
                    "flag": "🇨🇩",
                    "abbr": "COD",
                    "players": ["Chancel Mbemba", "Yoane Wissa", "Arthur Masuaku", "Samuel Moutoussamy", "Simon Banza", "Meschack Elia", "Theo Bongonda", "Gideon Kalulu", "Edo Kayembe", "Dimitry Bertaud"]
                },
                {
                    "id": "uzb",
                    "name": "Uzbequistão",
                    "flag": "🇺🇿",
                    "abbr": "UZB",
                    "players": ["Eldor Shomurodov", "Abbosbek Fayzullaev", "Otabek Shukurov", "Jaloliddin Masharipov", "Azizbek Turgunboev", "Odildzhon Khamrobekov", "Rustam Ashurmatov", "Abdukodir Khusanov", "Sherzod Nasrullaev", "Utkir Yusupov"]
                },
                {
                    "id": "col",
                    "name": "Colômbia",
                    "flag": "🇨🇴",
                    "abbr": "COL",
                    "players": ["Luis Díaz", "James Rodríguez", "Jhon Durán", "Richard Ríos", "Jefferson Lerma", "Daniel Muñoz", "Davinson Sánchez", "Carlos Cuesta", "Jhon Arias", "Camilo Vargas"]
                }
            ]
        },
        {
            "id": "L",
            "name": "Grupo L",
            "color": "#795548",
            "startNum": 297,
            "teams": [
                {
                    "id": "eng",
                    "name": "Inglaterra",
                    "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
                    "abbr": "ENG",
                    "players": ["Jude Bellingham", "Harry Kane", "Bukayo Saka", "Phil Foden", "Declan Rice", "Cole Palmer", "Kobbie Mainoo", "John Stones", "Kyle Walker", "Jordan Pickford"]
                },
                {
                    "id": "cro",
                    "name": "Croácia",
                    "flag": "🇭🇷",
                    "abbr": "CRO",
                    "players": ["Luka Modrić", "Mateo Kovačić", "Joško Gvardiol", "Dominik Livaković", "Marcelo Brozović", "Andrej Kramarić", "Luka Sučić", "Lovro Majer", "Josip Šutalo", "Ivan Perišić"]
                },
                {
                    "id": "gha",
                    "name": "Gana",
                    "flag": "🇬🇭",
                    "abbr": "GHA",
                    "players": ["Mohammed Kudus", "Thomas Partey", "Iñaki Williams", "Antoine Semenyo", "Ernest Nuamah", "Jordan Ayew", "Salis Abdul Samed", "Mohammed Salisu", "Tariq Lamptey", "Lawrence Ati Zigi"]
                },
                {
                    "id": "pan",
                    "name": "Panamá",
                    "flag": "🇵🇦",
                    "abbr": "PAN",
                    "players": ["Adalberto Carrasquilla", "Ismael Díaz", "José Fajardo", "Orlando Mosquera", "Aníbal Godoy", "Éric Davis", "Amir Murillo", "Fidel Escobar", "José Córdoba", "Puma Rodríguez"]
                }
            ]
        }
    ]
};

const TEAM_IMAGE_BASE_PATH = "/teams";

function getTeamImagePath(teamId) {
    return `${TEAM_IMAGE_BASE_PATH}/${teamId}.webp`;
}

ALBUM_DATA.groups = ALBUM_DATA.groups.map(group => ({
    ...group,
    teams: group.teams.map(team => ({
        ...team,
        image: team.image || getTeamImagePath(team.id),
    })),
}));

// Gera a lista plana de todas as figurinhas
function generateAllStickers() {
    const stickers = [];
    let num = 1;

    // Figurinhas especiais
    ALBUM_DATA.special.stickers.forEach(s => {
        stickers.push({
            id: `esp-${s.num}`,
            num: s.num,
            name: s.name,
            section: "especial",
            sectionName: "Especial",
            type: s.type,
            icon: s.icon,
            image: s.image || "",
            teamId: null,
            teamName: null,
            groupId: null,
        });
        num++;
    });

    // Figurinhas por grupo
    ALBUM_DATA.groups.forEach(group => {
        let stickerNum = group.startNum;

        // Figurinhas dos times
        group.teams.forEach(team => {
            // Escudo
            stickers.push({
                id: `${team.id}-badge`,
                num: stickerNum++,
                name: `${team.name} - Escudo`,
                section: `grupo-${group.id}`,
                sectionName: group.name,
                type: "badge",
                icon: team.flag,
                teamId: team.id,
                teamName: team.name,
                teamImage: team.image,
                groupId: group.id,
            });

            // Jogadores
            team.players.forEach((player, i) => {
                stickers.push({
                    id: `${team.id}-p${i + 1}`,
                    num: stickerNum++,
                    name: player,
                    section: `grupo-${group.id}`,
                    sectionName: group.name,
                    type: "player",
                    icon: team.flag,
                    teamId: team.id,
                    teamName: team.name,
                    teamImage: team.image,
                    groupId: group.id,
                });
            });
        });
    });

    return stickers;
}

const ALL_STICKERS = generateAllStickers();

if (typeof window !== "undefined") {
    window.ALBUM_DATA = ALBUM_DATA;
    window.ALL_STICKERS = ALL_STICKERS;
}
