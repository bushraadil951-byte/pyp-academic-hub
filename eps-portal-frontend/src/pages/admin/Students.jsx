import People from './People.jsx';
import { EY_GRADES, DT_GRADES } from '../../constants.js';
export default () => <People kind="students" grades={[...EY_GRADES, ...DT_GRADES]} singular="Student" />;
