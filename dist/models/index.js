"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionVerification = exports.ApiKey = exports.SmsLog = exports.Device = exports.User = exports.sequelize = void 0;
const User_1 = __importDefault(require("./User"));
exports.User = User_1.default;
const Device_1 = __importDefault(require("./Device"));
exports.Device = Device_1.default;
const SmsLog_1 = __importDefault(require("./SmsLog"));
exports.SmsLog = SmsLog_1.default;
const ApiKey_1 = __importDefault(require("./ApiKey"));
exports.ApiKey = ApiKey_1.default;
const TransactionVerification_1 = __importDefault(require("./TransactionVerification"));
exports.TransactionVerification = TransactionVerification_1.default;
var database_1 = require("../config/database");
Object.defineProperty(exports, "sequelize", { enumerable: true, get: function () { return database_1.sequelize; } });
// Associations
User_1.default.hasMany(Device_1.default, { foreignKey: 'userId' });
Device_1.default.belongsTo(User_1.default, { foreignKey: 'userId' });
Device_1.default.hasMany(SmsLog_1.default, { foreignKey: 'deviceId' });
SmsLog_1.default.belongsTo(Device_1.default, { foreignKey: 'deviceId' });
User_1.default.hasMany(ApiKey_1.default, { foreignKey: 'ownerId', as: 'apiKeys' });
ApiKey_1.default.belongsTo(User_1.default, { foreignKey: 'ownerId', as: 'owner' });
User_1.default.hasMany(TransactionVerification_1.default, { foreignKey: 'ownerId', as: 'transactionVerifications' });
TransactionVerification_1.default.belongsTo(User_1.default, { foreignKey: 'ownerId', as: 'owner' });
ApiKey_1.default.hasMany(TransactionVerification_1.default, { foreignKey: 'apiKeyId', as: 'verifications' });
TransactionVerification_1.default.belongsTo(ApiKey_1.default, { foreignKey: 'apiKeyId', as: 'apiKey' });
