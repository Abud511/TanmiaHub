CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`username` varchar(64) NOT NULL,
	`email` varchar(320),
	`passwordHash` varchar(191) NOT NULL,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`points` int NOT NULL DEFAULT 0,
	`level` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `completions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`doorId` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `completions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`doorId` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`doorId` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plans_id` PRIMARY KEY(`id`)
);
