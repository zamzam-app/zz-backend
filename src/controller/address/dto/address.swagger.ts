import { applyDecorators } from '@nestjs/common';
import {
    ApiOperation,
    ApiOkResponse,
    ApiCreatedResponse,
    ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Address } from '../entities/address.entity';

export function ApiAddressCreate() {
    return applyDecorators(
        ApiOperation({ summary: 'Create a new address' }),
        ApiCreatedResponse({
            description: 'Address created successfully.',
            type: Address,
        }),
    );
}

export function ApiAddressFindAll() {
    return applyDecorators(
        ApiOperation({ summary: 'Get all active addresses (Admin only)' }),
        ApiOkResponse({
            description: 'Return all active addresses.',
            type: [Address],
        }),
    );
}

export function ApiAddressFindOne() {
    return applyDecorators(
        ApiOperation({ summary: 'Get a specific address by ID' }),
        ApiOkResponse({
            description: 'Return the address details.',
            type: Address,
        }),
        ApiNotFoundResponse({ description: 'Address not found.' }),
    );
}

export function ApiAddressUpdate() {
    return applyDecorators(
        ApiOperation({ summary: 'Update an existing address' }),
        ApiOkResponse({
            description: 'Address updated successfully.',
            type: Address,
        }),
        ApiNotFoundResponse({ description: 'Address not found.' }),
    );
}

export function ApiAddressRemove() {
    return applyDecorators(
        ApiOperation({ summary: 'Soft delete an address' }),
        ApiOkResponse({
            description: 'Address deleted successfully.',
            type: Address,
        }),
        ApiNotFoundResponse({ description: 'Address not found.' }),
    );
}
