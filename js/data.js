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
            { num: 1, name: "Capa do Álbum", type: "cover", icon: "📖", image: "public/specials/especial_capa.png" },
            { num: 2, name: "Troféu FIFA World Cup", type: "trophy", icon: "🏆" },
            { num: 3, name: "Talisma Oficial", type: "mascot", icon: "🎭" },
            { num: 4, name: "Bola Oficial", type: "ball", icon: "⚽" },
            { num: 5, name: "Sede: Nova York / NJ", type: "stadium", icon: "🏟️" },
            { num: 6, name: "Sede: Los Angeles", type: "stadium", icon: "🏟️" },
            { num: 7, name: "Sede: Dallas", type: "stadium", icon: "🏟️" },
            { num: 8, name: "Sede: Cidade do México", type: "stadium", icon: "🏟️" },
            { num: 9, name: "Sede: Toronto", type: "stadium", icon: "🏟️" },
            { num: 10, name: "Sede: Vancouver", type: "stadium", icon: "🏟️" },
        ]
    },

    // Grupos e times
    groups: [
        {
            id: "A", name: "Grupo A", color: "#e74c3c",
            startNum: 11,
            teams: [
                {
                    id: "usa", name: "Estados Unidos", flag: "🇺🇸", abbr: "EUA",
                    players: ["Christian Pulisic", "Tyler Adams", "Weston McKennie", "Gio Reyna", "Matt Turner", "Folarin Balogun", "Yunus Musah", "Antonee Robinson", "Sergiño Dest", "Timothy Weah"]
                },
                {
                    id: "mar", name: "Marrocos", flag: "🇲🇦", abbr: "MAR",
                    players: ["Achraf Hakimi", "Hakim Ziyech", "Youssef En-Nesyri", "Sofyan Amrabat", "Bono", "Azzedine Ounahi", "Nayef Aguerd", "Brahim Díaz", "Abde Ezzalzouli", "Amine Adli"]
                },
                {
                    id: "sui", name: "Suíça", flag: "🇨🇭", abbr: "SUI",
                    players: ["Granit Xhaka", "Xherdan Shaqiri", "Yann Sommer", "Manuel Akanji", "Rubén Vargas", "Gregor Kobel", "Breel Embolo", "Denis Zakaria", "Remo Freuler", "Zeki Amdouni"]
                },
                {
                    id: "jor", name: "Jordânia", flag: "🇯🇴", abbr: "JOR",
                    players: ["Mousa Tamari", "Yazan Al-Naimat", "Ali Olwan", "Noor Al-Rawabdeh", "Nizar Al-Rashdan", "Yazeed Abulaila", "Abdallah Nasib", "Ehsan Haddad", "Salem Al-Ajalin", "Mahmoud Al-Mardi"]
                }
            ]
        },
        {
            id: "B", name: "Grupo B", color: "#e67e22",
            startNum: 37,
            teams: [
                {
                    id: "mex", name: "México", flag: "🇲🇽", abbr: "MEX",
                    players: ["Hirving Lozano", "Edson Álvarez", "Santiago Giménez", "Guillermo Ochoa", "Luis Chávez", "César Montes", "Johan Vásquez", "Orbelín Pineda", "Uriel Antuna", "Julián Quiñones"]
                },
                {
                    id: "ksa", name: "Arábia Saudita", flag: "🇸🇦", abbr: "KSA",
                    players: ["Salem Al-Dawsari", "Mohammed Al-Owais", "Firas Al-Buraikan", "Sami Al-Najei", "Ali Al-Bulayhi", "Saud Abdulhamid", "Abdulelah Al-Malki", "Mohamed Kanno", "Hassan Tambakti", "Abdulrahman Ghareeb"]
                },
                {
                    id: "den", name: "Dinamarca", flag: "🇩🇰", abbr: "DEN",
                    players: ["Christian Eriksen", "Kasper Schmeichel", "Pierre-Emile Højbjerg", "Andreas Christensen", "Rasmus Højlund", "Joachim Andersen", "Alexander Bah", "Mikkel Damsgaard", "Morten Hjulmand", "Jonas Wind"]
                },
                {
                    id: "sen", name: "Senegal", flag: "🇸🇳", abbr: "SEN",
                    players: ["Sadio Mané", "Édouard Mendy", "Kalidou Koulibaly", "Idrissa Gueye", "Ismaïla Sarr", "Nicolas Jackson", "Pape Matar Sarr", "Lamine Camara", "Abdou Diallo", "Iliman Ndiaye"]
                }
            ]
        },
        {
            id: "C", name: "Grupo C", color: "#f1c40f",
            startNum: 63,
            teams: [
                {
                    id: "can", name: "Canadá", flag: "🇨🇦", abbr: "CAN",
                    players: ["Alphonso Davies", "Jonathan David", "Tajon Buchanan", "Cyle Larin", "Stephen Eustáquio", "Ismaël Koné", "Alistair Johnston", "Kamal Miller", "Jonathan Osorio", "Dayne St. Clair"]
                },
                {
                    id: "aus", name: "Austrália", flag: "🇦🇺", abbr: "AUS",
                    players: ["Mat Ryan", "Harry Souttar", "Jackson Irvine", "Mitchell Duke", "Craig Goodwin", "Nestory Irankunda", "Connor Metcalfe", "Jordan Bos", "Keanu Baccus", "Alessandro Circati"]
                },
                {
                    id: "cro", name: "Croácia", flag: "🇭🇷", abbr: "CRO",
                    players: ["Luka Modrić", "Mateo Kovačić", "Joško Gvardiol", "Dominik Livaković", "Marcelo Brozović", "Andrej Kramarić", "Luka Sučić", "Lovro Majer", "Josip Šutalo", "Ivan Perišić"]
                },
                {
                    id: "per", name: "Peru", flag: "🇵🇪", abbr: "PER",
                    players: ["Pedro Gallese", "Luis Advíncula", "Renato Tapia", "Gianluca Lapadula", "André Carrillo", "Piero Quispe", "Alexander Callens", "Marcos López", "Bryan Reyna", "Joao Grimaldo"]
                }
            ]
        },
        {
            id: "D", name: "Grupo D", color: "#2ecc71",
            startNum: 89,
            teams: [
                {
                    id: "bra", name: "Brasil", flag: "🇧🇷", abbr: "BRA",
                    players: ["Vinícius Junior", "Rodrygo", "Endrick", "Bruno Guimarães", "Lucas Paquetá", "Marquinhos", "Gabriel Magalhães", "Alisson", "Éder Militão", "Savinho"]
                },
                {
                    id: "kor", name: "Coreia do Sul", flag: "🇰🇷", abbr: "KOR",
                    players: ["Heung-min Son", "Min-jae Kim", "Kang-in Lee", "Hee-chan Hwang", "Jae-sung Lee", "Gue-sung Cho", "In-beom Hwang", "Young-woo Seol", "Seung-gyu Kim", "Seung-ho Paik"]
                },
                {
                    id: "sco", name: "Escócia", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", abbr: "SCO",
                    players: ["Andy Robertson", "Scott McTominay", "John McGinn", "Billy Gilmour", "Kieran Tierney", "Lewis Ferguson", "Che Adams", "Angus Gunn", "Nathan Patterson", "Ryan Christie"]
                },
                {
                    id: "civ", name: "Costa do Marfim", flag: "🇨🇮", abbr: "CIV",
                    players: ["Sébastien Haller", "Franck Kessié", "Simon Adingra", "Ousmane Diomande", "Ibrahim Sangaré", "Evan Ndicka", "Seko Fofana", "Odilon Kossounou", "Yahia Fofana", "Wilfried Singo"]
                }
            ]
        },
        {
            id: "E", name: "Grupo E", color: "#1abc9c",
            startNum: 115,
            teams: [
                {
                    id: "arg", name: "Argentina", flag: "🇦🇷", abbr: "ARG",
                    players: ["Lionel Messi", "Julián Álvarez", "Enzo Fernández", "Alexis Mac Allister", "Lautaro Martínez", "Rodrigo De Paul", "Cristian Romero", "Emiliano Martínez", "Alejandro Garnacho", "Lisandro Martínez"]
                },
                {
                    id: "jpn", name: "Japão", flag: "🇯🇵", abbr: "JPN",
                    players: ["Takefusa Kubo", "Kaoru Mitoma", "Wataru Endo", "Takehiro Tomiyasu", "Ritsu Doan", "Hidemasa Morita", "Ayase Ueda", "Keito Nakamura", "Hiroki Ito", "Zion Suzuki"]
                },
                {
                    id: "tur", name: "Turquia", flag: "🇹🇷", abbr: "TUR",
                    players: ["Arda Güler", "Hakan Çalhanoğlu", "Kenan Yıldız", "Ferdi Kadıoğlu", "Orkun Kökçü", "Barış Alper Yılmaz", "Kerem Aktürkoğlu", "Merih Demiral", "Çağlar Söyüncü", "Mert Günok"]
                },
                {
                    id: "nga", name: "Nigéria", flag: "🇳🇬", abbr: "NGA",
                    players: ["Victor Osimhen", "Ademola Lookman", "Victor Boniface", "Alex Iwobi", "Wilfred Ndidi", "Samuel Chukwueze", "Calvin Bassey", "Ola Aina", "Stanley Nwabali", "Terem Moffi"]
                }
            ]
        },
        {
            id: "F", name: "Grupo F", color: "#3498db",
            startNum: 141,
            teams: [
                {
                    id: "fra", name: "França", flag: "🇫🇷", abbr: "FRA",
                    players: ["Kylian Mbappé", "Antoine Griezmann", "Eduardo Camavinga", "Aurélien Tchouaméni", "William Saliba", "Ousmane Dembélé", "Mike Maignan", "Warren Zaïre-Emery", "Theo Hernández", "Bradley Barcola"]
                },
                {
                    id: "col", name: "Colômbia", flag: "🇨🇴", abbr: "COL",
                    players: ["Luis Díaz", "James Rodríguez", "Jhon Durán", "Richard Ríos", "Jefferson Lerma", "Daniel Muñoz", "Davinson Sánchez", "Carlos Cuesta", "Jhon Arias", "Camilo Vargas"]
                },
                {
                    id: "aut", name: "Áustria", flag: "🇦🇹", abbr: "AUT",
                    players: ["David Alaba", "Marcel Sabitzer", "Konrad Laimer", "Christoph Baumgartner", "Nicolas Seiwald", "Xaver Schlager", "Kevin Danso", "Michael Gregoritsch", "Patrick Wimmer", "Alexander Schlager"]
                },
                {
                    id: "irq", name: "Iraque", flag: "🇮🇶", abbr: "IRQ",
                    players: ["Aymen Hussein", "Ali Jasim", "Zidane Iqbal", "Ibrahim Bayesh", "Amir Al-Ammari", "Youssef Amyn", "Saad Natiq", "Rebin Sulaka", "Hussein Ali", "Jalal Hassan"]
                }
            ]
        },
        {
            id: "G", name: "Grupo G", color: "#9b59b6",
            startNum: 167,
            teams: [
                {
                    id: "ger", name: "Alemanha", flag: "🇩🇪", abbr: "GER",
                    players: ["Florian Wirtz", "Jamal Musiala", "Kai Havertz", "Leroy Sané", "Joshua Kimmich", "İlkay Gündoğan", "Antonio Rüdiger", "Jonathan Tah", "Marc-André ter Stegen", "Niclas Füllkrug"]
                },
                {
                    id: "ecu", name: "Equador", flag: "🇪🇨", abbr: "ECU",
                    players: ["Moisés Caicedo", "Pervis Estupiñán", "Enner Valencia", "Piero Hincapié", "Kendry Páez", "Willian Pacho", "Angelo Preciado", "Jeremy Sarmiento", "Kevin Rodríguez", "Hernán Galíndez"]
                },
                {
                    id: "egy", name: "Egito", flag: "🇪🇬", abbr: "EGY",
                    players: ["Mohamed Salah", "Omar Marmoush", "Mostafa Mohamed", "Trezeguet", "Mohamed Elneny", "Emam Ashour", "Ahmed Hegazi", "Mohamed Abdelmonem", "Hamdy Fathy", "Mohamed El Shenawy"]
                },
                {
                    id: "rou", name: "Romênia", flag: "🇷🇴", abbr: "ROU",
                    players: ["Radu Drăgușin", "Nicolae Stanciu", "Ianis Hagi", "Dennis Man", "Florinel Coman", "Răzvan Marin", "Denis Drăguș", "Andrei Rațiu", "Horațiu Moldovan", "Valentin Mihăilă"]
                }
            ]
        },
        {
            id: "H", name: "Grupo H", color: "#e91e63",
            startNum: 193,
            teams: [
                {
                    id: "esp", name: "Espanha", flag: "🇪🇸", abbr: "ESP",
                    players: ["Lamine Yamal", "Pedri", "Gavi", "Rodri", "Nico Williams", "Dani Olmo", "Pau Cubarsí", "Álex Grimaldo", "Daniel Carvajal", "Unai Simón"]
                },
                {
                    id: "ven", name: "Venezuela", flag: "🇻🇪", abbr: "VEN",
                    players: ["Salomón Rondón", "Yangel Herrera", "Yeferson Soteldo", "Jefferson Savarino", "Eduard Bello", "Nahuel Ferraresi", "Jon Aramburu", "José Martínez", "Darwin Machís", "Rafael Romo"]
                },
                {
                    id: "srb", name: "Sérvia", flag: "🇷🇸", abbr: "SRB",
                    players: ["Dušan Vlahović", "Aleksandar Mitrović", "Sergej Milinković-Savić", "Lazar Samardžić", "Strahinja Pavlović", "Nikola Milenković", "Filip Kostić", "Dušan Tadić", "Andrija Živković", "Predrag Rajković"]
                },
                {
                    id: "dza", name: "Argélia", flag: "🇩🇿", abbr: "DZA",
                    players: ["Riyad Mahrez", "Ismaël Bennacer", "Rayan Aït-Nouri", "Mohamed Amoura", "Farès Chaïbi", "Amine Gouiri", "Said Benrahma", "Aissa Mandi", "Anthony Mandrea", "Houssem Aouar"]
                }
            ]
        },
        {
            id: "I", name: "Grupo I", color: "#00bcd4",
            startNum: 219,
            teams: [
                {
                    id: "eng", name: "Inglaterra", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", abbr: "ENG",
                    players: ["Jude Bellingham", "Harry Kane", "Bukayo Saka", "Phil Foden", "Declan Rice", "Cole Palmer", "Kobbie Mainoo", "John Stones", "Kyle Walker", "Jordan Pickford"]
                },
                {
                    id: "irn", name: "Irã", flag: "🇮🇷", abbr: "IRN",
                    players: ["Mehdi Taremi", "Sardar Azmoun", "Alireza Jahanbakhsh", "Saman Ghoddos", "Mehdi Ghayedi", "Saeed Ezatolahi", "Milad Mohammadi", "Hossein Kanaanizadegan", "Ramin Rezaeian", "Alireza Beiranvand"]
                },
                {
                    id: "pol", name: "Polônia", flag: "🇵🇱", abbr: "POL",
                    players: ["Robert Lewandowski", "Piotr Zieliński", "Nicola Zalewski", "Sebastian Szymański", "Jakub Kiwior", "Przemysław Frankowski", "Karol Świderski", "Kacper Urbański", "Jan Bednarek", "Łukasz Skorupski"]
                },
                {
                    id: "gha", name: "Gana", flag: "🇬🇭", abbr: "GHA",
                    players: ["Mohammed Kudus", "Thomas Partey", "Iñaki Williams", "Antoine Semenyo", "Ernest Nuamah", "Jordan Ayew", "Salis Abdul Samed", "Mohammed Salisu", "Tariq Lamptey", "Lawrence Ati Zigi"]
                }
            ]
        },
        {
            id: "J", name: "Grupo J", color: "#ff5722",
            startNum: 245,
            teams: [
                {
                    id: "por", name: "Portugal", flag: "🇵🇹", abbr: "POR",
                    players: ["Cristiano Ronaldo", "Bruno Fernandes", "Rafael Leão", "Bernardo Silva", "João Neves", "Vitinha", "Rúben Dias", "João Cancelo", "Gonçalo Inácio", "Diogo Costa"]
                },
                {
                    id: "uru", name: "Uruguai", flag: "🇺🇾", abbr: "URU",
                    players: ["Federico Valverde", "Darwin Núñez", "Facundo Pellistri", "Manuel Ugarte", "Nicolás de la Cruz", "Ronald Araújo", "Mathías Olivera", "José María Giménez", "Sergio Rochet", "Luciano Rodríguez"]
                },
                {
                    id: "ned", name: "Países Baixos", flag: "🇳🇱", abbr: "NED",
                    players: ["Virgil van Dijk", "Frenkie de Jong", "Cody Gakpo", "Xavi Simons", "Jeremie Frimpong", "Micky van de Ven", "Nathan Aké", "Tijjani Reijnders", "Donyell Malen", "Bart Verbruggen"]
                },
                {
                    id: "rsa", name: "África do Sul", flag: "🇿🇦", abbr: "RSA",
                    players: ["Percy Tau", "Teboho Mokoena", "Ronwen Williams", "Lyle Foster", "Themba Zwane", "Khuliso Mudau", "Mothobi Mvala", "Aubrey Modiba", "Evidence Makgopa", "Thapelo Morena"]
                }
            ]
        },
        {
            id: "K", name: "Grupo K", color: "#607d8b",
            startNum: 271,
            teams: [
                {
                    id: "ita", name: "Itália", flag: "🇮🇹", abbr: "ITA",
                    players: ["Gianluigi Donnarumma", "Nicolò Barella", "Federico Chiesa", "Alessandro Bastoni", "Riccardo Calafiori", "Davide Frattesi", "Mateo Retegui", "Gianluca Scamacca", "Destiny Udogie", "Lorenzo Pellegrini"]
                },
                {
                    id: "bel", name: "Bélgica", flag: "🇧🇪", abbr: "BEL",
                    players: ["Kevin De Bruyne", "Jeremy Doku", "Amadou Onana", "Lois Openda", "Leandro Trossard", "Johan Bakayoko", "Wout Faes", "Timothy Castagne", "Arthur Theate", "Koen Casteels"]
                },
                {
                    id: "pan", name: "Panamá", flag: "🇵🇦", abbr: "PAN",
                    players: ["Adalberto Carrasquilla", "Ismael Díaz", "José Fajardo", "Orlando Mosquera", "Aníbal Godoy", "Éric Davis", "Amir Murillo", "Fidel Escobar", "José Córdoba", "Puma Rodríguez"]
                },
                {
                    id: "uzb", name: "Uzbequistão", flag: "🇺🇿", abbr: "UZB",
                    players: ["Eldor Shomurodov", "Abbosbek Fayzullaev", "Otabek Shukurov", "Jaloliddin Masharipov", "Azizbek Turgunboev", "Odildzhon Khamrobekov", "Rustam Ashurmatov", "Abdukodir Khusanov", "Sherzod Nasrullaev", "Utkir Yusupov"]
                }
            ]
        },
        {
            id: "L", name: "Grupo L", color: "#795548",
            startNum: 297,
            teams: [
                {
                    id: "hon", name: "Honduras", flag: "🇭🇳", abbr: "HON",
                    players: ["Anthony Lozano", "Luis Palma", "Edwin Rodríguez", "Deiby Flores", "Bryan Róchez", "Joseph Rosales", "Denil Maldonado", "Andy Najar", "Rigoberto Rivas", "Edrick Menjívar"]
                },
                {
                    id: "jam", name: "Jamaica", flag: "🇯🇲", abbr: "JAM",
                    players: ["Leon Bailey", "Michail Antonio", "Bobby Reid", "Demarai Gray", "Ethan Pinnock", "Shamar Nicholson", "Joel Latibeaudiere", "Dexter Lembikisa", "Kasey Palmer", "Andre Blake"]
                },
                {
                    id: "cmr", name: "Camarões", flag: "🇨🇲", abbr: "CMR",
                    players: ["André Onana", "Bryan Mbeumo", "Vincent Aboubakar", "Frank Anguissa", "Christopher Wooh", "Georges-Kevin Nkoudou", "Jean-Charles Castelletto", "Nouhou Tolo", "Faris Moumbagna", "Carlos Baleba"]
                },
                {
                    id: "nzl", name: "Nova Zelândia", flag: "🇳🇿", abbr: "NZL",
                    players: ["Chris Wood", "Liberato Cacace", "Sarpreet Singh", "Joe Bell", "Marko Stamenic", "Matthew Garbett", "Ben Waine", "Tyler Bindon", "Nando Pijnaker", "Alex Paulsen"]
                }
            ]
        }
    ]
};

const TEAM_IMAGE_BASE_PATH = "/teams";

function getTeamImagePath(teamId) {
    return `${TEAM_IMAGE_BASE_PATH}/${teamId}.png`;
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
