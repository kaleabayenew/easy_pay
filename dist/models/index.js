"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsLog = exports.Device = exports.User = exports.sequelize = void 0;
const User_1 = __importDefault(require("./User"));
exports.User = User_1.default;
const Device_1 = __importDefault(require("./Device"));
exports.Device = Device_1.default;
const SmsLog_1 = __importDefault(require("./SmsLog"));
exports.SmsLog = SmsLog_1.default;
var database_1 = require("../config/database");
Object.defineProperty(exports, "sequelize", { enumerable: true, get: function () { return database_1.sequelize; } });
// Associations
User_1.default.hasMany(Device_1.default, { foreignKey: 'userId' });
Device_1.default.belongsTo(User_1.default, { foreignKey: 'userId' });
Device_1.default.hasMany(SmsLog_1.default, { foreignKey: 'deviceId' });
SmsLog_1.default.belongsTo(Device_1.default, { foreignKey: 'deviceId' });
