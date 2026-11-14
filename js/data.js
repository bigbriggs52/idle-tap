// Content data: labs (map locations), floor products, tier names, tech unlock names.
window.SVT = window.SVT || {};

// First names for hired managers. Each lab's `crew` gives the job titles for its floor, lift and warehouse managers
// (v0.30), so a Rare floor manager in the Arcade District is a "Rare Cabinet Builder".
// v0.43 (user: "I want the managers to look like Viking characters"): Viking Raid hires get Norse names.
SVT.VIKING_NAMES = ["Bjorn", "Astrid", "Ragnar", "Freydis", "Leif", "Sigrid", "Ivar", "Gunnhild", "Harald", "Thyra", "Ulf", "Ingrid", "Erik", "Helga", "Sven", "Runa", "Torvald", "Solveig", "Halfdan", "Ylva", "Knut", "Brynja", "Gorm", "Estrid", "Olaf", "Hilda", "Rollo", "Lagertha", "Egil", "Svala"];
SVT.MANAGER_NAMES = ["Ada", "Grace", "Alan", "Hedy", "Kay", "Steve", "Radia", "Dennis", "Margaret", "Ken", "Frances", "Jean", "Barbara", "Lynn", "Mark", "Priya", "Diego", "Mei", "Omar", "Sofia", "Kofi", "Yuki", "Nina", "Raj", "Leah", "Theo", "Ivy", "Marco", "Zara", "Ben"];

SVT.TIERS = [
  { from: 1, to: 5, name: "Early Computing" },
  { from: 6, to: 10, name: "8-Bit & 16-Bit Era" },
  { from: 11, to: 18, name: "Mobile Boom" },
  { from: 19, to: 25, name: "Smart Devices" },
  { from: 26, to: 30, name: "Flagship Tech" },
];

// Rotating names for the small unlock every 5 levels, one list per tier.
SVT.TECH_UNLOCKS = [
  ["Magnifier lamp", "Better soldering iron", "Anti-static mats", "Parts drawers", "Test jig", "Coffee machine", "Label printer", "Bench power supply"],
  ["Logic analyzer", "EPROM burner", "Dual monitors", "Oscilloscope", "Cartridge tester", "Assembler macros", "Ergonomic chairs", "Snack machine"],
  ["PCB CAD license", "RF shield box", "Drop-test rig", "Reflow oven", "Pick-and-place arm", "Signal generator", "Disc burner tower", "Team offsite"],
  ["CI build server", "Thermal camera", "Device farm", "Standing desks", "Benchmark suite", "Design system", "Crash reporter", "Free lunch"],
  ["Cleanroom suits", "Wafer prober", "GPU cluster", "Hinge fatigue robot", "Simulation farm", "Anechoic chamber", "Lab automation", "Nap pods"],
];

SVT.LABS = [
  {
    id: "garage", name: "Garage HQ", theme: "Consumer electronics", icon: "🔧", x: 30, y: 85,
    crew: ["Bench Tech", "Parts Runner", "Shop Clerk"],
    teams: ["Junior Techs", "Firmware Engineers", "PCB Designers", "Software Engineers", "Chip Architects"],
    products: ["Four-function calculator", "Digital wristwatch", "LED keychain game", "Pocket AM/FM radio", "Electronic organizer",
      "Dot-matrix handheld console", "CRT mini-monitor", "Dot-matrix printer", "8-bit home computer", "16-bit home console",
      "Dial-up modem", "CD-ROM drive", "Alphanumeric pager", "Flip phone", "MP3 player", "DVD player", "Point-and-shoot camera", "Color-screen slider phone",
      "Wi-Fi router", "Touchscreen smartphone", "3D graphics card", "Quad-core laptop", "Tablet", "Smartwatch", "Wireless earbuds",
      "Next-gen game console", "Folding flagship phone", "VR headset", "Autonomous delivery drone", "AI neural accelerator"],
  },
  {
    id: "arcade", name: "Arcade District", theme: "Gaming", icon: "🕹️", x: 50, y: 69,
    crew: ["Cabinet Builder", "Token Runner", "Arcade Host"],
    teams: ["Playtesters", "Cabinet Builders", "Console Engineers", "Game Devs", "Graphics Architects"],
    products: ["Paddle tennis box", "Electronic pinball board", "LCD handheld game", "Coin-op cabinet", "Light gun",
      "Cartridge console", "Arcade joystick", "Pocket monochrome handheld", "Memory card", "Polygon racing cabinet",
      "Rumble controller", "Dance mat", "Network adapter", "Color handheld", "Optical-disc console", "Gaming headset", "Motion controller", "Dual-screen handheld",
      "HD console", "Gaming mouse", "Mechanical keyboard", "Capture card", "Gaming laptop", "VR controllers", "Handheld gaming PC",
      "Cloud gaming server", "Esports arena rig", "Haptic suit", "Holographic tabletop", "AI game director"],
  },
  {
    id: "library", name: "Archive Library", theme: "Books & knowledge", icon: "📚", x: 70, y: 85,
    crew: ["Archivist", "Stack Runner", "Front Desk Librarian"],
    teams: ["Archivists", "Scanner Techs", "Database Engineers", "Search Engineers", "AI Researchers"],
    products: ["Card catalog terminal", "Microfiche reader", "Barcode wand", "Book-return sorter", "Talking dictionary",
      "Library PC", "Floppy encyclopedia", "Thermal receipt printer", "Microfilm scanner", "Audiobook cassette deck",
      "CD-ROM encyclopedia", "Flatbed scanner", "Digital audiobook player", "RFID book tag", "Self-checkout kiosk", "Pocket translator", "Laptop cart", "Smart whiteboard",
      "E-ink reader", "Book-scanning robot", "Search server", "Study tablet", "Reading-pen scanner", "Translation earpiece", "Digital archive vault",
      "Knowledge graph engine", "AR study glasses", "Robotic shelf crawler", "Universal translator", "AI tutor"],
  },
  {
    id: "maker", name: "Maker Workshop", theme: "Crafting", icon: "🛠️", x: 30, y: 53,
    crew: ["Kit Builder", "Tool Crib Keeper", "Market Stall Seller"],
    teams: ["Hobbyists", "Kit Builders", "Machinists", "Robotics Makers", "Fab Engineers"],
    products: ["Soldering kit", "Breadboard", "Multimeter", "Blinking LED badge", "Hobby robot kit",
      "Microcontroller board", "LED light strip", "Vinyl cutter", "Hot-wire foam cutter", "Sewing machine controller",
      "Desktop 3D printer", "Laser engraver", "Mini CNC mill", "PCB mill", "Resin printer", "Embroidery machine", "Drone kit", "Desktop pick-and-place",
      "Multi-color 3D printer", "Laser cutter", "Robot arm kit", "Smart sewing robot", "Metal 3D printer", "Wearable LED jacket", "Automated loom",
      "Bio-plastic extruder", "Self-replicating printer", "Swarm robot kit", "Pocket fab lab", "AI design assistant"],
  },
  {
    id: "studio", name: "Sound Studio", theme: "Audio & music", icon: "🎧", x: 70, y: 53,
    crew: ["Sound Engineer", "Roadie", "Tour Manager"],
    teams: ["Roadies", "Audio Techs", "Sound Engineers", "DSP Developers", "Acoustic Scientists"],
    products: ["Cassette recorder", "Transistor radio", "Portable cassette player", "Boombox", "Electronic metronome",
      "Drum machine", "Analog synthesizer", "MIDI keyboard", "Sampler", "Guitar effects pedal",
      "Portable CD player", "Mixing desk", "Karaoke machine", "DAW workstation", "Studio monitors", "Digital piano", "Vocal tuner", "Hard-disk recorder",
      "Noise-cancelling headphones", "Smart speaker", "Audio interface", "Wireless mic system", "Spatial audio soundbar", "Hearing-aid earbuds", "Modular synth",
      "Concert line array", "Holographic stage rig", "Bone-conduction headset", "Neural music generator", "AI mastering engine"],
  },
  // Locations 6-30 open one at a time: beating a lab (IPO) opens the lab five places after it.
  {
    id: "cinema", name: "Cinema Studios", theme: "Film & video", icon: "🎬", x: 90, y: 69,
    crew: ["Camera Operator", "Grip", "Box Office Lead"],
    teams: ["Grips", "Camera Techs", "Editors", "VFX Artists", "Virtual Production Engineers"],
    products: ["Hand-crank projector", "Film splicer", "Light meter", "Clapperboard", "8mm home camera", "Super 8 projector", "Movieola editor", "VHS camcorder", "Betamax deck", "Studio light rig", "Steadicam vest", "Video mixer", "Teleprompter", "Laserdisc player", "Digital camcorder", "Non-linear edit bay", "Green screen kit", "DVD authoring station", "HD broadcast camera", "Camera crane", "Motion-capture suit", "4K cinema camera", "Gimbal stabilizer", "Cinema drone", "Color grading panel", "LED volume wall", "8K streaming rig", "Holographic projector", "Virtual set engine", "AI film editor"],
  },
  {
    id: "robotics", name: "Robotics Foundry", theme: "Robots", icon: "🤖", x: 50, y: 24,
    crew: ["Robot Wrangler", "Conveyor Tech", "Fleet Dealer"],
    teams: ["Wire Wranglers", "Servo Techs", "Motion Engineers", "Robotics Programmers", "Autonomy Scientists"],
    products: ["Wind-up tin robot", "Remote-control car", "Line-following bot", "Robot arm toy", "Talking robot pet", "Servo controller", "Rover kit", "Sumo bot", "Welding arm", "Robot vacuum", "Pick-and-place robot", "Bipedal walker", "Robot lawn mower", "Warehouse rover", "Surgical arm", "Quadruped robot", "Delivery robot", "Exoskeleton", "Cobot workstation", "Robot chef", "Swarm drones", "Underwater ROV", "Humanoid helper", "Robot hand", "Soft robot gripper", "Space rover", "Self-driving forklift", "Robot dog guardian", "Nanobot assembler", "General-purpose android"],
  },
  {
    id: "auto", name: "EV Auto Plant", theme: "Electric vehicles", icon: "🚗", x: 10, y: 56,
    crew: ["Line Mechanic", "Battery Hauler", "Showroom Rep"],
    teams: ["Lugnut Crew", "Battery Techs", "Drivetrain Engineers", "Firmware Engineers", "Autonomy Engineers"],
    products: ["Electric go-kart", "E-scooter", "E-bike", "Golf cart", "Electric moped", "Mini EV hatchback", "Charging cable", "Wall charger", "Battery pack", "Electric motor", "Regenerative brake kit", "EV sedan", "Fast-charge station", "Heads-up display", "EV pickup truck", "Lane-keep camera", "Electric bus", "Solid-state battery", "EV SUV", "Wireless charging pad", "Battery swap station", "Lidar sensor", "Robotaxi", "Electric semi truck", "Flying car prototype", "Vehicle-to-grid inverter", "Autonomous shuttle", "Hyper-charging network", "Solar car", "AI autopilot"],
  },
  {
    id: "space", name: "Space Port", theme: "Spaceflight", icon: "🚀", x: 90, y: 24,
    crew: ["Rocket Engineer", "Payload Loader", "Launch Broker"],
    teams: ["Launch Pad Crew", "Avionics Techs", "Propulsion Engineers", "Mission Controllers", "Rocket Scientists"],
    products: ["Model rocket", "Weather balloon", "Ham radio beacon", "CubeSat kit", "Star tracker", "Ground antenna", "Sounding rocket", "Space suit glove", "Reaction wheel", "Solar panel wing", "Satellite bus", "Ion thruster", "Re-entry capsule", "Docking port", "Lunar lander", "Reusable booster", "Space telescope", "Crew capsule", "Mars rover", "Orbital tug", "Space station module", "Asteroid probe", "Heavy-lift rocket", "Moon habitat", "Space elevator tether", "Fusion drive", "Orbital shipyard", "Starship hull", "Interstellar probe", "AI mission brain"],
  },
  {
    id: "medtech", name: "Med-Tech Clinic", theme: "Medical devices", icon: "🩺", x: 50, y: 88,
    crew: ["Device Engineer", "Supply Porter", "Clinic Buyer"],
    teams: ["Orderlies", "Lab Techs", "Biomedical Engineers", "Imaging Specialists", "Med AI Researchers"],
    products: ["Digital thermometer", "Stethoscope", "Blood pressure cuff", "Pulse oximeter", "Glucose meter", "Hearing aid", "Nebulizer", "ECG monitor", "Defibrillator", "Infusion pump", "Ultrasound probe", "Insulin pump", "Pacemaker", "X-ray machine", "Dialysis machine", "Ventilator", "CT scanner", "Cochlear implant", "MRI scanner", "Bionic arm", "Robotic surgery cart", "Smart contact lens", "Gene sequencer", "Wearable heart patch", "Lab-on-a-chip", "3D bioprinter", "Artificial heart", "Neural implant", "Nanomed injector", "AI diagnostician"],
  },
  {
    id: "agri", name: "AgriTech Farms", theme: "Farming", icon: "🌾", x: 10, y: 88,
    crew: ["Field Engineer", "Harvest Hauler", "Market Trader"],
    teams: ["Farmhands", "Irrigation Techs", "Soil Scientists", "Drone Pilots", "Agri AI Engineers"],
    products: ["Seed planter", "Soil thermometer", "Drip irrigation kit", "Egg incubator", "Milking machine", "Grain moisture meter", "Greenhouse fan", "Electric fence", "Sprinkler timer", "Hydroponic tray", "Weather station", "GPS tractor guide", "Livestock tag", "Crop-spray drone", "Grain silo sensor", "Vertical farm rack", "Robotic milker", "Soil probe network", "Smart beehive", "Autonomous tractor", "Fruit-picking robot", "Weed laser bot", "Aquaponics pod", "Satellite crop map", "Lab-grown meat vat", "Desert greenhouse", "Pollinator drone", "Climate-proof seed vault", "Indoor mega-farm", "AI harvest planner"],
  },
  {
    id: "ocean", name: "Ocean Lab", theme: "Marine tech", icon: "🌊", x: 90, y: 88,
    crew: ["Dive Tech", "Deck Hand", "Harbor Master"],
    teams: ["Deckhands", "Dive Techs", "Marine Engineers", "Sonar Specialists", "Ocean Scientists"],
    products: ["Fish finder", "Diving watch", "Underwater flashlight", "Marine radio", "Depth sounder", "Snorkel camera", "Buoy beacon", "Scuba regulator", "Sonar scanner", "Tide gauge", "Dive computer", "Underwater drone", "Wave-power buoy", "Deep-sea camera", "Ocean glider", "Desalination unit", "Coral nursery rig", "Submersible pod", "Seafloor mapper", "Hydrophone array", "Tidal turbine", "Floating wind turbine", "Ocean cleanup boom", "Deep-sea habitat", "Autonomous research ship", "Kelp farm rig", "Whale tracker tag", "Abyssal crawler", "Floating city module", "AI ocean monitor"],
  },
  {
    id: "arctic", name: "Arctic Data Center", theme: "Data centers", icon: "❄️", x: 10, y: 8,
    crew: ["Rack Engineer", "Cable Puller", "Cloud Reseller"],
    teams: ["Rack Stackers", "Network Techs", "Systems Engineers", "Cloud Architects", "Data Scientists"],
    products: ["Floppy disk", "Tape drive", "Mainframe terminal", "Hard disk drive", "Network hub", "Rack server", "Ethernet switch", "RAID array", "Fiber patch panel", "Blade server", "Load balancer", "Backup library", "SSD array", "Cooling tower", "Edge server", "Hyperscale rack", "Liquid cooling loop", "GPU node", "Undersea cable", "Data lake", "Exabyte vault", "Immersion tank", "Arctic heat recycler", "Optical switch", "DNA storage drive", "Photonic server", "Quantum-safe router", "Zettabyte archive", "Planetary cloud", "AI data steward"],
  },
  {
    id: "geo", name: "Geothermal Works", theme: "Geothermal energy", icon: "🌋", x: 70, y: 5,
    crew: ["Drill Engineer", "Steam Fitter", "Grid Dispatcher"],
    teams: ["Roughnecks", "Drill Techs", "Thermal Engineers", "Grid Engineers", "Geoscientists"],
    products: ["Hot spring thermometer", "Pressure gauge", "Steam valve", "Heat pump", "Seismic sensor", "Drill bit", "Mud pump", "Geothermal heat exchanger", "Brine separator", "Turbine blade", "Binary cycle unit", "Deep well casing", "Steam turbine", "Cooling stack", "Smart grid meter", "Enhanced geothermal rig", "Magma probe", "Heat battery", "Plasma drill", "Thermal storage tank", "Supercritical well", "Volcano observatory", "Lithium brine extractor", "Deep heat mine", "Crust tunnel borer", "Hot rock reactor", "Continental heat grid", "Magma power plant", "Core tap", "AI heat forecaster"],
  },
  {
    id: "stadium", name: "Sports Tech Stadium", theme: "Sports tech", icon: "🏟️", x: 90, y: 37,
    crew: ["Gear Engineer", "Kit Runner", "Merch Captain"],
    teams: ["Groundskeepers", "Equipment Techs", "Performance Engineers", "Broadcast Engineers", "Sports Scientists"],
    products: ["Stopwatch", "Scoreboard", "Pedometer", "Radar speed gun", "Heart rate strap", "Shot clock", "Smart ball", "Instant replay deck", "Jumbotron", "GPS sports vest", "Goal-line camera", "Smart running shoe", "Batting cage robot", "Concussion sensor", "Ref headset", "Player tracking chip", "Smart turf", "VR training rig", "Retractable roof motor", "Hawk-eye system", "Exo-recovery suit", "Drone camera cam", "Smart stadium seats", "Hologram replays", "Esports pod", "Biomech lab", "Anti-gravity treadmill", "Mixed-reality arena", "Robot referee", "AI coach"],
  },
  {
    id: "fashion", name: "Wearables Atelier", theme: "Wearable tech", icon: "👗", x: 70, y: 72,
    crew: ["Pattern Maker", "Fabric Courier", "Boutique Buyer"],
    teams: ["Seamstresses", "Pattern Techs", "Textile Engineers", "Wearable Designers", "Smart Fabric Scientists"],
    products: ["Light-up sneakers", "Mood ring", "Calculator watch", "Glow bracelet", "Heated gloves", "LED necklace", "Fitness band", "Solar backpack", "Bluetooth beanie", "Smart ring", "Color-shift jacket", "Haptic belt", "Posture shirt", "Smart glasses", "Self-lacing shoes", "Charging handbag", "Temperature-control vest", "E-ink tote", "Health-tracking socks", "Smart contact jewelry", "Adaptive running tights", "Holo-dress", "Biometric hoodie", "Exo-knee brace", "Shape-shift fabric", "Invisible-cloak prototype", "Solar silk gown", "Neural headband", "Living textile", "AI stylist"],
  },
  {
    id: "toys", name: "Toy Factory", theme: "Toys", icon: "🧸", x: 30, y: 72,
    crew: ["Toy Designer", "Box Stacker", "Shop Santa"],
    teams: ["Elves", "Assembly Techs", "Toy Engineers", "Game Designers", "Play Scientists"],
    products: ["Spinning top", "Yo-yo", "Wind-up mouse", "Talking doll", "Electronic quiz board", "Slot car set", "Walkie-talkies", "Light-up puzzle", "Robot dinosaur", "Laser tag set", "Remote-control boat", "Virtual pet", "Building-block robot", "Interactive plush", "Toy drone", "Coding robot", "Smart train set", "AR puzzle cube", "Self-balancing toy", "Kid smartwatch", "Hologram figure", "Magnetic racetrack", "Stem lab kit", "Robot pet dog", "Gesture-control car", "Mixed-reality playset", "Shape-shifting blocks", "Companion bot", "Dream projector", "AI toy maker"],
  },
  {
    id: "home", name: "Smart Home Suburb", theme: "Smart home", icon: "🏡", x: 50, y: 56,
    crew: ["Gadget Installer", "Van Driver", "Showhome Host"],
    teams: ["Handymen", "Installers", "Home Systems Engineers", "IoT Developers", "Home AI Researchers"],
    products: ["Electric doorbell", "Garage door opener", "TV remote", "Smoke detector", "Programmable thermostat", "Motion light", "Intercom", "Robot vacuum dock", "Smart plug", "Video doorbell", "Smart bulb", "Smart lock", "Mesh Wi-Fi node", "Smart fridge", "Voice assistant hub", "Security camera", "Smart blinds", "Leak sensor", "Smart oven", "Solar roof tile", "Home battery wall", "Robot window cleaner", "Smart mirror", "Laundry folding bot", "Home energy brain", "Air-quality tower", "Drone mailbox", "Self-healing walls", "Holo-living room", "AI butler"],
  },
  {
    id: "drone", name: "Drone Airfield", theme: "Drones", icon: "🛩️", x: 10, y: 37,
    crew: ["Flight Engineer", "Hangar Hand", "Air Dispatcher"],
    teams: ["Ground Crew", "Flight Techs", "Aero Engineers", "Flight Software Devs", "Swarm Researchers"],
    products: ["Balsa glider", "Rubber-band plane", "RC airplane", "RC helicopter", "Gyro stabilizer", "Mini quadcopter", "FPV goggles", "Camera drone", "Racing drone", "Drone controller", "Gimbal camera", "Survey drone", "Delivery drone", "Thermal drone", "Drone dock", "Fixed-wing mapper", "Cargo drone", "Drone traffic radar", "Firefighting drone", "Swarm show drones", "Air-taxi prototype", "Solar HALE drone", "Hydrogen drone", "Drone mothership", "Autonomous airport", "Medical drone network", "Weather-seeding drone", "Stratospheric relay", "Sky highway system", "AI flight controller"],
  },
  {
    id: "cyber", name: "Cyber Security Vault", theme: "Cybersecurity", icon: "🛡️", x: 50, y: 37,
    crew: ["Security Engineer", "Key Courier", "Deal Broker"],
    teams: ["Badge Checkers", "SOC Analysts", "Security Engineers", "Pen Testers", "Cryptographers"],
    products: ["Combination lock", "Key fob", "Password keypad", "Antivirus disk", "Firewall box", "Smart card reader", "VPN router", "Security token", "Fingerprint scanner", "Intrusion detector", "Encrypted USB", "Iris scanner", "Face-ID camera", "Hardware wallet", "Honeypot server", "Threat intel feed", "Zero-trust gateway", "Secure enclave chip", "Bug bounty platform", "Deepfake detector", "Post-quantum key", "Red team simulator", "Cyber range", "Self-healing network", "Secure satellite link", "Quantum key distributor", "Digital fortress", "Unbreakable vault OS", "Planet-scale firewall", "AI threat hunter"],
  },
  {
    id: "fintech", name: "Fintech Tower", theme: "Finance tech", icon: "🏦", x: 70, y: 21,
    crew: ["Quant", "Vault Runner", "Account Manager"],
    teams: ["Tellers", "Payment Techs", "Quant Developers", "Blockchain Engineers", "Risk Scientists"],
    products: ["Adding machine", "Cash register", "Coin counter", "ATM", "Credit card terminal", "Check scanner", "Ticker display", "Trading terminal", "Chip card reader", "Mobile wallet", "Contactless reader", "Robo-advisor", "Crypto miner", "Payments API", "Fraud detector", "High-frequency rack", "Digital ID kiosk", "Smart contract engine", "Stablecoin vault", "Micro-loan app", "Real-time ledger", "Tokenized exchange", "Central bank coin", "Instant settlement net", "Biometric checkout", "Market simulator", "Global payment mesh", "Quantum trading core", "Autonomous bank", "AI fund manager"],
  },
  {
    id: "weather", name: "Weather Station", theme: "Weather tech", icon: "🌦️", x: 30, y: 21,
    crew: ["Sensor Engineer", "Balloon Crew", "Forecast Anchor"],
    teams: ["Balloon Launchers", "Instrument Techs", "Atmospheric Engineers", "Forecast Modelers", "Climate Scientists"],
    products: ["Mercury barometer", "Rain gauge", "Wind vane", "Anemometer", "Hygrometer", "Weather radio", "Radiosonde", "Doppler radar", "Lightning detector", "Snow depth sensor", "Weather satellite dish", "Storm chaser van", "Ocean buoy station", "Tornado probe", "Wind profiler", "Hail pad array", "Ice core drill", "Supercomputer node", "Hurricane hunter drone", "Air-quality network", "Cloud-seeding rig", "Climate model cluster", "Carbon capture tower", "Global sensor web", "Weather satellite swarm", "Storm steering array", "Sunshade mirror", "Ocean cooling pump", "Planetary thermostat", "AI weather oracle"],
  },
  {
    id: "rail", name: "Maglev Rail Yard", theme: "Rail", icon: "🚄", x: 90, y: 8,
    crew: ["Track Engineer", "Freight Loader", "Station Master"],
    teams: ["Track Gang", "Signal Techs", "Rail Engineers", "Control Engineers", "Transit Scientists"],
    products: ["Model train set", "Railroad crossing light", "Signal lever", "Ticket punch", "Electric locomotive", "Trolley car", "Track circuit", "Subway turnstile", "Departure board", "Smart ticket gate", "Bullet train", "Automatic train control", "Light rail car", "Freight tracker", "Hyperloop pod model", "Maglev bogie", "Rail inspection drone", "Driverless metro", "Superconducting magnet", "Vacuum tube segment", "Station robot porter", "Transcontinental maglev", "Cargo hyperloop", "Floating rail bridge", "Undersea tunnel", "Gravity train", "Orbital rail launcher", "Continental tube network", "Planet loop", "AI rail dispatcher"],
  },
  {
    id: "biotech", name: "Biotech Greenhouse", theme: "Biotech", icon: "🧬", x: 70, y: 40,
    crew: ["Lab Scientist", "Sample Courier", "Pharma Rep"],
    teams: ["Plant Tenders", "Lab Assistants", "Bioengineers", "Geneticists", "Synthetic Biologists"],
    products: ["Microscope", "Petri dish incubator", "Centrifuge", "Pipette robot", "pH meter", "Autoclave", "PCR machine", "Gel imager", "Cell counter", "Bioreactor", "DNA synthesizer", "Flow cytometer", "Gene gun", "CRISPR kit", "Organ-on-chip", "Algae fuel tank", "Spider-silk vat", "Glowing plant", "Biofoundry", "Enzyme printer", "Synthetic seed", "Living concrete", "Protein folder", "Microbe factory", "Artificial leaf", "Gene drive lab", "Regrowth tank", "Biofab city block", "Living computer", "AI protein designer"],
  },
  {
    id: "quantum", name: "Quantum Lab", theme: "Quantum computing", icon: "⚛️", x: 30, y: 5,
    crew: ["Qubit Engineer", "Cryo Porter", "Grant Officer"],
    teams: ["Cryo Crew", "Laser Techs", "Quantum Engineers", "Qubit Programmers", "Quantum Physicists"],
    products: ["Vacuum tube", "Laser pointer", "Photon detector", "Cryostat", "Superconducting wire", "Ion trap", "Optical table", "Single-photon source", "Josephson junction", "Qubit chip", "Dilution fridge", "Quantum random generator", "Microwave controller", "Quantum sensor", "Photonic chip", "Error-correction board", "Quantum network node", "Topological qubit", "Quantum memory", "Quantum simulator", "1,000-qubit processor", "Quantum cloud rack", "Entanglement relay", "Quantum internet hub", "Million-qubit array", "Room-temperature qubit", "Quantum supercomputer", "Time-crystal clock", "Universal quantum core", "AI quantum compiler"],
  },
  {
    id: "satellite", name: "Satellite Uplink", theme: "Satellites", icon: "📡", x: 90, y: 56,
    crew: ["Antenna Engineer", "Dish Rigger", "Bandwidth Dealer"],
    teams: ["Dish Crew", "RF Techs", "Satellite Engineers", "Network Engineers", "Orbital Scientists"],
    products: ["Crystal radio", "Rabbit-ear antenna", "Shortwave receiver", "TV satellite dish", "GPS receiver", "Satellite phone", "Uplink truck", "Transponder", "Ground station", "Phased-array antenna", "Laser comms terminal", "Pocket sat messenger", "Nano satellite", "Earth-imaging sat", "Broadband constellation", "Inter-satellite link", "Satellite internet dish", "Orbit debris tracker", "Weather sat", "Radar imaging sat", "Direct-to-phone sat", "Optical ground node", "Mega-constellation", "Space data relay", "Moon relay sat", "Deep space antenna", "Mars comms network", "Solar power satellite", "Interplanetary internet", "AI orbit manager"],
  },
  {
    id: "energy", name: "Energy Grid", theme: "Power", icon: "⚡", x: 10, y: 69,
    crew: ["Grid Engineer", "Line Crew", "Energy Trader"],
    teams: ["Linemen", "Grid Techs", "Power Engineers", "Battery Engineers", "Fusion Scientists"],
    products: ["Battery cell", "Light switch", "Fuse box", "Electric meter", "Transformer", "Wind-up generator", "Diesel generator", "Solar panel", "Power inverter", "Wind turbine", "Smart meter", "Home battery", "Substation", "Microgrid controller", "EV charging hub", "Grid-scale battery", "Pumped hydro pump", "Offshore wind farm", "Hydrogen electrolyzer", "Superconducting cable", "Virtual power plant", "Thorium reactor", "Small modular reactor", "Space solar receiver", "Continental supergrid", "Fusion test reactor", "Stellarator", "Fusion power plant", "Planetary grid", "AI grid operator"],
  },
  {
    id: "holo", name: "Holo Theater", theme: "Holograms & XR", icon: "🎭", x: 30, y: 40,
    crew: ["Light Artist", "Stage Crew", "Ticket Lead"],
    teams: ["Stagehands", "Projection Techs", "Optics Engineers", "XR Developers", "Holography Scientists"],
    products: ["Stereoscope", "View-Master", "Magic lantern", "3D glasses", "Pepper's ghost rig", "Laser show projector", "VR headset", "AR goggles", "Motion tracker", "Volumetric camera", "Holo fan display", "Light-field display", "Haptic gloves", "Mixed-reality studio", "Holographic phone", "XR concert stage", "Spatial audio dome", "Holo telepresence booth", "Volumetric theater", "Holodeck room", "Retinal projector", "Touchable hologram", "Holo street ads", "Dream recorder", "Full-sense VR pod", "Shared holo world", "Holo city overlay", "Brain-link headset", "Reality engine", "AI holo director"],
  },
  {
    id: "mars", name: "Mars Outpost", theme: "Mars colony", icon: "🪐", x: 50, y: 8,
    crew: ["Habitat Engineer", "Rover Driver", "Supply Officer"],
    teams: ["Settlers", "Habitat Techs", "Life Support Engineers", "Terraform Engineers", "Planetary Scientists"],
    products: ["Mars globe", "Dust filter", "Oxygen candle", "Pressure suit", "Rover wheel", "Water extractor", "Solar dust wiper", "Inflatable habitat", "Regolith brick press", "Greenhouse dome", "MOXIE oxygen maker", "Mars helicopter", "Ice drill", "Fuel plant", "Radiation shield", "Pressurized rover", "Hab ring", "Mars farm", "Nuclear power pod", "Lava-tube city", "Mars hyperloop", "Magnetic shield", "Atmosphere factory", "Mars shipyard", "Phobos station", "Terraforming mirror", "Mars ocean pump", "Breathable-air dome", "Red planet capital", "AI colony governor"],
  },
  {
    id: "moon", name: "Moonbase", theme: "Lunar base", icon: "🌙", x: 10, y: 24,
    crew: ["Regolith Engineer", "Airlock Crew", "Earth Liaison"],
    teams: ["Moonwalkers", "Rover Techs", "Lunar Engineers", "Mining Engineers", "Lunar Scientists"],
    products: ["Moon map poster", "Lunar sample box", "Retroreflector", "Lunar lander kit", "Moon buggy", "Regolith shovel", "Lunar solar array", "Ice prospector", "Habitat igloo", "Lunar 3D printer", "Helium-3 extractor", "Moon telescope", "Mass driver", "Lunar railway", "Crater power tower", "Moon farm", "Lunar factory", "Far-side radio dish", "Moon hotel", "Lunar spaceport", "Lunar elevator", "Moon mine", "Shielded city dome", "Earth-Moon ferry", "Lunar data center", "Moon fusion plant", "Lunar shipyard", "Lunar university", "Lunar capital", "AI moon overseer"],
  },
  // v0.48 (user: "I think I've only got 2 maps left in the main game. Make a bunch more"): labs 31 to 50 on a second
  // map, The Frontier (map: 2). Labs without a map are on the first one.
  {
    id: "deepsea", name: "Deep Sea Colony", theme: "Undersea living", icon: "🐙", x: 14, y: 88, map: 2,
    crew: ["Aquanaut", "Sub Pilot", "Pearl Trader"],
    teams: ["Divers", "Hull Techs", "Pressure Engineers", "Marine Roboticists", "Abyss Scientists"],
    products: ["Snorkel mask", "Dive watch", "Depth gauge", "Scuba regulator", "Underwater flashlight", "Fish finder sonar", "Dive computer", "Diving bell", "Underwater camera", "Mini submarine", "Bubble habitat", "Kelp farm net", "Pressure door", "Hydrophone array", "Sea-floor drone", "Desalination pod", "Tidal turbine", "Coral printer", "Deep-dive suit", "Undersea cable", "Abyss lantern", "Sea-floor mining crawler", "Glass dome district", "Whale-song translator", "Trench elevator", "Hydrothermal power plant", "Submarine liner", "Ocean-floor city", "Abyss research station", "AI tide keeper"],
  },
  {
    id: "nano", name: "Nano Foundry", theme: "Nanotech", icon: "🔬", x: 38, y: 83, map: 2,
    crew: ["Cleanroom Tech", "Wafer Courier", "Nano Broker"],
    teams: ["Lab Techs", "Microscopists", "Materials Engineers", "Nanobot Designers", "Molecular Scientists"],
    products: ["Magnifying glass", "Pocket microscope", "Petri dish", "Pipette", "Lab centrifuge", "Spectrometer", "Electron microscope", "Graphene sheet", "Carbon nanotube", "Atomic force probe", "Quantum dot ink", "Self-cleaning glass", "Smart dust sensor", "Nano filter", "Molecular printer", "Nanobot swarm", "Shape-shifting fabric", "Nano battery", "Medical nanobot", "Self-healing paint", "Programmable matter", "Nano assembler", "Diamond fiber", "Atom-by-atom 3D printer", "Nano surgeon", "Utility fog", "Grey-goo containment unit", "Molecular factory", "Matter compiler", "AI nano architect"],
  },
  {
    id: "cloudcity", name: "Cloud City", theme: "Sky cities", icon: "☁️", x: 62, y: 88, map: 2,
    crew: ["Sky Rigger", "Blimp Pilot", "Sky Concierge"],
    teams: ["Riggers", "Balloon Techs", "Aero Engineers", "Sky Architects", "Atmospheric Scientists"],
    products: ["Paper kite", "Weather vane", "Barometer", "Hot-air balloon", "Parachute", "Glider", "Blimp", "Wind sock", "Hang glider", "Air taxi", "Sky crane", "Floating platform", "Airship dock", "Cloud seeder", "Wind harvester", "Skybridge", "Aerostat antenna", "Jet pack", "Sky farm", "Floating hotel", "Sky tram", "Anti-gravity pad", "Floating stadium", "Cloud harvester", "Sky mall", "Storm shield", "Stratosphere port", "Flying district", "Cloud capital", "AI sky warden"],
  },
  {
    id: "asteroid", name: "Asteroid Mine", theme: "Space mining", icon: "☄️", x: 86, y: 83, map: 2,
    crew: ["Rock Driller", "Ore Hauler", "Ore Assayer"],
    teams: ["Prospectors", "Drill Techs", "Mining Engineers", "Orbital Haulers", "Planetary Geologists"],
    products: ["Rock hammer", "Gold pan", "Metal detector", "Pickaxe", "Ore cart", "Core drill", "Jackhammer", "Mining helmet", "Space suit", "Asteroid tether", "Ore scanner", "Harpoon lander", "Regolith grinder", "Ice miner", "Ore smelter", "Mining tug", "Mass catcher", "Platinum refinery", "Asteroid tug", "Space forge", "Ore freighter", "Orbital smelter", "Belt outpost", "Asteroid hollow city", "Gravity tractor", "Comet water plant", "Mining mothership", "Asteroid redirector", "Belt capital", "AI ore oracle"],
  },
  {
    id: "neural", name: "Neural Link Lab", theme: "Brain tech", icon: "🧠", x: 86, y: 64, map: 2,
    crew: ["Neuro Tech", "Signal Runner", "Mind Coach"],
    teams: ["Lab Assistants", "EEG Techs", "Neuro Engineers", "Interface Designers", "Neuroscientists"],
    products: ["Mood ring", "Lie detector", "EEG cap", "Biofeedback monitor", "Sleep tracker", "Hearing aid", "Brain trainer", "Focus headband", "Cochlear implant", "Neural stimulator", "Thought typing kit", "Dream journal app", "Mind-controlled arm", "Memory booster", "Neural lace", "Brain scanner", "Emotion reader", "Language uploader", "Skill chip", "Thought messenger", "Shared dream rig", "Mind-to-cloud backup", "Hive-mind hub", "Synthetic senses", "Neural cinema", "Brain-cloud server", "Consciousness mirror", "Telepathy network", "Digital mind", "AI neural twin"],
  },
  {
    id: "chrono", name: "Chrono Lab", theme: "Time & clocks", icon: "⏳", x: 62, y: 69, map: 2,
    crew: ["Clockmaker", "Time Courier", "Era Guide"],
    teams: ["Apprentices", "Clock Techs", "Timing Engineers", "Physicists", "Time Theorists"],
    products: ["Sundial", "Hourglass", "Pocket watch", "Cuckoo clock", "Metronome", "Stopwatch", "Alarm clock", "Grandfather clock", "Quartz watch", "Digital clock", "Atomic clock", "GPS time server", "Time-lapse camera", "Timer chip", "Optical lattice clock", "Time capsule", "Chrono stabilizer", "Slow-motion camera", "Time crystal", "Chronograph satellite", "Pause field", "Time dilation pod", "Paradox detector", "Past viewer", "Future forecaster", "Time loop chamber", "Chrono gate", "Timeline vault", "Time machine", "AI timekeeper"],
  },
  {
    id: "jupiter", name: "Jupiter Station", theme: "Gas giant base", icon: "🌀", x: 38, y: 64, map: 2,
    crew: ["Storm Chaser", "Probe Wrangler", "Station Purser"],
    teams: ["Crew Hands", "Probe Techs", "Storm Engineers", "Moon Surveyors", "Planetary Scientists"],
    products: ["Star chart", "Planet globe", "Telescope", "Radio receiver", "Weather balloon", "Storm tracker", "Space probe", "Radiation badge", "Ion thruster", "Gas scoop", "Floating aerostat", "Lightning harvester", "Magnetosphere shield", "Europa ice drill", "Io volcano probe", "Ganymede base", "Helium skimmer", "Storm-proof station", "Moon shuttle", "Red spot observatory", "Orbital shipyard", "Jovian refinery", "Moon network", "Gravity slingshot port", "Ring habitat", "Callisto city", "Storm power plant", "Jovian capital", "Gas giant ark", "AI storm pilot"],
  },
  {
    id: "dino", name: "Dino Park", theme: "Genetics park", icon: "🦖", x: 14, y: 69, map: 2,
    crew: ["Gene Keeper", "Paddock Ranger", "Park Guide"],
    teams: ["Rangers", "Fossil Techs", "Gene Engineers", "Vet Surgeons", "Paleogeneticists"],
    products: ["Fossil brush", "Amber stone", "Dino egg replica", "Bone saw", "Field microscope", "DNA kit", "Gene sequencer", "Incubator", "Electric fence", "Tracking collar", "Raptor cam", "Gene printer", "Paddock drone", "Hatchery dome", "Dino translator", "Safari jeep", "Clone lab", "Mammoth pen", "Herd tracker", "Gyrosphere ride", "Feathered flyer aviary", "T-rex paddock", "Sea reptile lagoon", "Dino vet bay", "Ice-age valley", "Sabertooth den", "Gene vault", "Lost-world dome", "Living museum", "AI park warden"],
  },
  {
    id: "orbithotel", name: "Orbital Hotel", theme: "Space tourism", icon: "🏨", x: 14, y: 50, map: 2,
    crew: ["Zero-G Host", "Shuttle Bellhop", "Space Concierge"],
    teams: ["Stewards", "Cabin Techs", "Life Support Crew", "Hospitality Engineers", "Tourism Planners"],
    products: ["Room key card", "Space pen", "Freeze-dried meal", "Hotel robot", "Window telescope", "Zero-G cup", "Sleeping pod", "Space suit rental", "Moon postcard printer", "Orbital shuttle", "Spin-gravity ring", "Zero-G pool", "Space spa", "Earth-view lounge", "Space restaurant", "Spacewalk tour", "Moon cruise", "Orbital casino", "Star theater", "Zero-G gym", "Wedding chapel pod", "Honeymoon capsule", "Space concert hall", "Orbital theme park", "Luxury rotating suite", "Grand atrium", "Space cruise liner", "Orbital resort", "Galaxy grand hotel", "AI concierge"],
  },
  {
    id: "desert", name: "Desert Citadel", theme: "Desert tech", icon: "🏜️", x: 38, y: 45, map: 2,
    crew: ["Dune Engineer", "Caravan Driver", "Oasis Merchant"],
    teams: ["Nomads", "Solar Techs", "Water Engineers", "Sand Architects", "Climate Scientists"],
    products: ["Compass", "Water canteen", "Sun hat", "Sand goggles", "Camel saddle", "Solar cooker", "Fog net", "Sand buggy", "Dew collector", "Solar still", "Sand-proof drone", "Sand battery", "Solar tower", "Air water generator", "Dune glider", "Desert greenhouse", "Sand 3D printer", "Salt power plant", "Oasis maker", "Mirage display", "Sandstorm shield", "Solar highway", "Sand-glass city", "Desert hyperloop", "Rain maker", "Sun-to-fuel plant", "Green wall", "Desert ocean", "Citadel of the sun", "AI dune master"],
  },
  {
    id: "subway", name: "Hyperloop Depot", theme: "Underground transit", icon: "🚇", x: 62, y: 50, map: 2,
    crew: ["Tunnel Engineer", "Pod Dispatcher", "Ticket Master"],
    teams: ["Tunnel Crews", "Track Techs", "Transit Engineers", "Maglev Designers", "Network Planners"],
    products: ["Subway token", "Ticket punch", "Signal lantern", "Turnstile", "Rail lantern", "Tunnel map", "Track switch", "Metro car", "Escalator", "Tunnel boring machine", "Smart fare card", "Driverless train", "Platform screen door", "Vacuum tube", "Hyperloop pod", "Linear motor", "Air lock station", "Cargo loop", "City-to-city tube", "Pod switching hub", "Underwater tunnel", "Continental loop", "Personal pod", "Quake-proof tube", "Supersonic loop", "Loop megastation", "Polar express tube", "Global loop", "Planet-core tunnel", "AI loop controller"],
  },
  {
    id: "rainforest", name: "Rainforest Dome", theme: "Eco tech", icon: "🌳", x: 86, y: 45, map: 2,
    crew: ["Canopy Ranger", "Seed Runner", "Eco Guide"],
    teams: ["Gardeners", "Botany Techs", "Eco Engineers", "Forest Architects", "Ecologists"],
    products: ["Seed packet", "Watering can", "Bird whistle", "Bug jar", "Rain gauge", "Trail camera", "Plant moisture meter", "Canopy walkway", "Butterfly house", "Tree sensor", "Seed-planting drone", "Mist irrigator", "Frog monitor", "Rewilding robot", "Vertical forest", "Carbon tree", "Soil sensor net", "Biodome", "Pollinator drone", "Living wall", "Cloud forest maker", "Glowing tree", "Gene bank", "Forest city", "Rain machine", "Rewilded valley", "Ark dome", "Planet seeder", "Gaia engine", "AI forest spirit"],
  },
  {
    id: "magma", name: "Magma Forge", theme: "Volcanic industry", icon: "🔥", x: 86, y: 26, map: 2,
    crew: ["Lava Smith", "Slag Hauler", "Forge Trader"],
    teams: ["Smiths", "Furnace Techs", "Heat Engineers", "Alloy Designers", "Volcanologists"],
    products: ["Horseshoe", "Blacksmith hammer", "Anvil", "Bellows", "Tongs", "Casting mold", "Heat suit", "Kiln", "Steel ingot", "Arc furnace", "Thermal drill", "Lava sampler", "Heat-proof drone", "Magma turbine", "Obsidian blade", "Lava rover", "Super alloy", "Magma probe", "Heat exchanger", "Crucible press", "Lava tunnel", "Volcano power plant", "Magma battery", "Molten salt reactor", "Lava city", "Core forge", "Eruption tamer", "Planet forge", "Heart of the volcano", "AI forge master"],
  },
  {
    id: "antimatter", name: "Antimatter Lab", theme: "Particle physics", icon: "✴️", x: 62, y: 31, map: 2,
    crew: ["Beam Tech", "Isotope Courier", "Grant Writer"],
    teams: ["Assistants", "Detector Techs", "Accelerator Engineers", "Particle Physicists", "Theorists"],
    products: ["Static ball", "Cloud chamber", "Geiger counter", "Van de Graaff", "Cathode ray tube", "Magnet coil", "Cyclotron", "Bubble chamber", "Particle detector", "Superconducting magnet", "Linear accelerator", "Antimatter trap", "Muon tracker", "Neutrino detector", "Collider ring", "Plasma bottle", "Positron gun", "Dark matter detector", "Antimatter battery", "Higgs counter", "Warp bubble test rig", "Antimatter engine", "Quark sorter", "Strange matter vault", "Big-bang simulator", "Particle forge", "Antimatter reactor", "Black hole lab", "Universe simulator", "AI physicist"],
  },
  {
    id: "elevator", name: "Space Elevator", theme: "Orbit access", icon: "🛗", x: 38, y: 26, map: 2,
    crew: ["Tether Climber", "Cargo Lifter", "Sky Port Agent"],
    teams: ["Climbers", "Cable Techs", "Tether Engineers", "Orbital Architects", "Space Physicists"],
    products: ["Climbing rope", "Pulley", "Winch", "Lift button", "Cable reel", "Elevator car", "Counterweight", "Carbon cable", "Tower crane", "Climber robot", "Tether spool", "Laser power beam", "Ocean anchor platform", "Climber pod", "Halfway station", "Debris dodger", "Cargo climber", "Orbital counterweight", "Tether repair bot", "Sky lobby", "Geo station", "Elevator hotel", "Launch ring", "Moon tether", "Orbital ring", "Elevator city", "Twin tethers", "Ring world dock", "Stairway to space", "AI lift captain"],
  },
  {
    id: "dyson", name: "Dyson Swarm", theme: "Star power", icon: "☀️", x: 14, y: 31, map: 2,
    crew: ["Mirror Tech", "Beam Rider", "Energy Broker"],
    teams: ["Mirror Crews", "Panel Techs", "Beam Engineers", "Swarm Architects", "Stellar Scientists"],
    products: ["Magnifying lens", "Solar calculator", "Solar lamp", "Sun tracker", "Solar sail", "Mirror panel", "Light collector", "Photon battery", "Orbital mirror", "Microwave beam", "Solar satellite", "Beam receiver", "Statite", "Swarm factory", "Mirror swarm", "Star lifter", "Sun shade", "Corona probe", "Mercury mine", "Solar foundry", "Swarm ring", "Laser highway", "Stellar engine", "Shell segment", "Matrioshka brain", "Star harness", "Sun bubble", "Dyson sphere", "Kardashev crown", "AI sun keeper"],
  },
  {
    id: "venus", name: "Venus Cloud Station", theme: "Venus floating city", icon: "🌫️", x: 14, y: 12, map: 2,
    crew: ["Acid Engineer", "Cloud Skiff Pilot", "Station Steward"],
    teams: ["Crew", "Envelope Techs", "Acid Engineers", "Float Architects", "Atmosphere Scientists"],
    products: ["Gas mask", "Acid test strip", "Balloon pump", "Heat shield tile", "Envelope patch kit", "Cloud sampler", "Float bladder", "Acid-proof suit", "Sky skiff", "Aerostat module", "Sulfur scrubber", "Cloud farm", "Wind rider", "Venus glider", "Lightning rod tower", "Acid refinery", "Floating dome", "Cloud tram", "Surface probe", "Storm surfer", "Atmosphere cooler", "Cloud city ring", "Venus sunshade", "Sky continent", "Carbon catcher", "Floating capital", "Venus ark", "Terraform cloud", "Morning-star city", "AI cloud mayor"],
  },
  {
    id: "titan", name: "Titan Port", theme: "Saturn moon port", icon: "🧊", x: 38, y: 7, map: 2,
    crew: ["Methane Pilot", "Ice Hauler", "Port Officer"],
    teams: ["Dock Hands", "Cryo Techs", "Fuel Engineers", "Ring Navigators", "Moon Scientists"],
    products: ["Thermos", "Ice skates", "Fuel canister", "Cryo glove", "Ice saw", "Hover sled", "Methane lamp", "Cryo suit", "Lake buoy", "Ice crawler", "Methane drill", "Fuel depot", "Lake submarine", "Ring glider", "Dune walker", "Methane refinery", "Ice harbor", "Cryo vault", "Ring observatory", "Titan airship", "Saturn shuttle", "Moon relay", "Ring mine", "Cryo city", "Fuel megaport", "Lake city", "Saturn shipyard", "Ring station", "Saturn capital", "AI harbor master"],
  },
  {
    id: "wormhole", name: "Wormhole Gate", theme: "Deep space travel", icon: "🌌", x: 62, y: 12, map: 2,
    crew: ["Gate Keeper", "Jump Pilot", "Star Trader"],
    teams: ["Cadets", "Gate Techs", "Warp Engineers", "Star Navigators", "Cosmologists"],
    products: ["Star map", "Radio telescope", "Space buoy", "Navigation beacon", "Star tracker", "Gravity wave detector", "Warp coil", "Jump drive", "Gate ring", "Exotic matter tank", "Wormhole probe", "Gate control room", "Starship", "Galaxy map", "Colony ship", "Alien signal decoder", "Gate network", "Star harbor", "Generation ship", "Interstellar freighter", "Galactic relay", "Star gate city", "Black hole tap", "Time-gate", "Galaxy cruiser", "Cosmic web map", "Universe gate", "Galactic council hall", "Infinity gate", "AI star navigator"],
  },
  {
    id: "galactic", name: "Galactic HQ", theme: "The final frontier", icon: "🏛️", x: 86, y: 7, map: 2,
    crew: ["Star Admiral", "Fleet Quartermaster", "Galactic Envoy"],
    teams: ["Recruits", "Fleet Techs", "Starship Engineers", "Galaxy Architects", "Cosmic Scientists"],
    products: ["Founder's badge", "Mission patch", "Command chair", "Holo comm", "Fleet radio", "Star chart table", "Bridge console", "Shuttle bay", "Fleet scanner", "Diplomatic translator", "Planet terraformer", "Fleet carrier", "Star fortress", "Galactic bank", "Trade hub", "Peace treaty vault", "Star academy", "Galactic senate", "Nebula refinery", "Star nursery", "Galaxy-wide net", "Planet maker", "Sun builder", "Galaxy engine", "Cosmic library", "Multiverse window", "Reality anchor", "Galaxy crown", "Universe HQ", "AI galactic overseer"],
  },
];
