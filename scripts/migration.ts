import * as fs from 'fs';

export class Migration {
    log_path: string;
    migration_log;
    balance_history;
    
    constructor(log_path = 'migration-log.json') {
        this.log_path = log_path;
        this.migration_log = {};
        this.balance_history = [];
        this._loadMigrationLog();
    }

    _loadMigrationLog() {
        if (fs.existsSync(this.log_path)) {
            const data = fs.readFileSync(this.log_path, 'utf8');
            if (data) this.migration_log = JSON.parse(data);
        }
    }

    reset() {
        this.migration_log = {};
        this.balance_history = [];
        this._saveMigrationLog();
    }

    _saveMigrationLog() {
        fs.writeFileSync(this.log_path, JSON.stringify(this.migration_log));
    }

    exists(alias) {
        return this.migration_log[alias] !== undefined;
    }

    load(contractName, alias) {
        let contract = locklift.factory.getDeployedContract(contractName);
        if (this.migration_log[alias] !== undefined) {
            contract = locklift.factory.getDeployedContract(contractName, this.migration_log[alias].address);
        } else {
            throw new Error(`Contract ${alias} not found in the migration`);
        }
        return contract;
    }

    store(contractAddress, contractName, alias) {
        this.migration_log = {
            ...this.migration_log,
            [alias]: {
                address: contractAddress.toString(),
                name: contractName
            }
        }
        this._saveMigrationLog();
    }
}

module.exports = {
    Migration
}
