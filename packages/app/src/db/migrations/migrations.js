import journal from './meta/_journal.json';
import m0000 from './0000_bouncy_gauntlet.sql';
import m0001 from './0001_careless_omega_flight.sql';
import m0002 from './0002_recategorize_legacy_categories.sql';
import m0003 from './0003_split_shirt_category.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003
    }
  }
  