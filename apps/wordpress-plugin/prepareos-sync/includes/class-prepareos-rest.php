<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers REST API endpoints for PrepareOS to call.
 */
class PrepareOS_REST {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register REST routes under /wp-json/prepareos/v1/
	 */
	public function register_routes() {
		register_rest_route( 'prepareos/v1', '/ping', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'handle_ping' ),
			'permission_callback' => '__return_true',
		) );

		register_rest_route( 'prepareos/v1', '/sync/categories', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_sync_categories' ),
			'permission_callback' => array( $this, 'check_api_key' ),
		) );
	}

	/**
	 * Verify the Bearer token matches the stored API key.
	 */
	public function check_api_key( $request ) {
		$auth_header = $request->get_header( 'Authorization' );
		if ( empty( $auth_header ) ) {
			return new WP_Error( 'rest_forbidden', 'Missing Authorization header.', array( 'status' => 401 ) );
		}

		$token = str_replace( 'Bearer ', '', $auth_header );
		$stored_key = get_option( PrepareOS_Admin::OPTION_API_KEY, '' );

		if ( empty( $stored_key ) || ! hash_equals( $stored_key, $token ) ) {
			return new WP_Error( 'rest_forbidden', 'Invalid API key.', array( 'status' => 403 ) );
		}

		return true;
	}

	/**
	 * GET /wp-json/prepareos/v1/ping
	 */
	public function handle_ping( $request ) {
		$api_key    = get_option( PrepareOS_Admin::OPTION_API_KEY, '' );
		$has_key    = ! empty( $api_key );
		$site_name  = get_bloginfo( 'name' );
		$site_url   = get_site_url();

		return rest_ensure_response( array(
			'ok'       => true,
			'plugin'   => 'prepareos-sync',
			'version'  => PREPAREOS_SYNC_VERSION,
			'hasKey'   => $has_key,
			'siteName' => $site_name,
			'siteUrl'  => $site_url,
		) );
	}

	/**
	 * POST /wp-json/prepareos/v1/sync/categories
	 *
	 * Receives categories from PrepareOS and creates/updates them in WooCommerce.
	 * Body: { "categories": [{ "id": "uuid", "name": "...", "description": "...", "parentId": "uuid"|null, "imageUrl": "..." }] }
	 */
	public function handle_sync_categories( $request ) {
		$body       = $request->get_json_params();
		$categories = isset( $body['categories'] ) ? $body['categories'] : array();

		if ( empty( $categories ) ) {
			return new WP_Error( 'no_categories', 'No categories provided.', array( 'status' => 400 ) );
		}

		$created = 0;
		$updated = 0;

		// Build a map of PrepareOS UUID -> WooCommerce term_id for parent resolution
		// First pass: collect existing mappings from term meta
		$uuid_to_woo_id = array();
		$existing_terms = get_terms( array(
			'taxonomy'   => 'product_cat',
			'hide_empty' => false,
			'meta_key'   => '_prepareos_id',
		) );

		if ( ! is_wp_error( $existing_terms ) ) {
			foreach ( $existing_terms as $term ) {
				$prepareos_id = get_term_meta( $term->term_id, '_prepareos_id', true );
				if ( $prepareos_id ) {
					$uuid_to_woo_id[ $prepareos_id ] = (int) $term->term_id;
				}
			}
		}

		// Process categories: parents first (parentId === null), then children
		$roots    = array();
		$children = array();
		foreach ( $categories as $cat ) {
			if ( empty( $cat['parentId'] ) ) {
				$roots[] = $cat;
			} else {
				$children[] = $cat;
			}
		}
		$sorted = array_merge( $roots, $children );

		foreach ( $sorted as $cat ) {
			$name        = sanitize_text_field( $cat['name'] );
			$description = isset( $cat['description'] ) ? sanitize_textarea_field( $cat['description'] ) : '';
			$prepareos_id = $cat['id'];

			// Resolve WooCommerce parent
			$woo_parent = 0;
			if ( ! empty( $cat['parentId'] ) && isset( $uuid_to_woo_id[ $cat['parentId'] ] ) ) {
				$woo_parent = $uuid_to_woo_id[ $cat['parentId'] ];
			}

			// Check if this category already exists (by PrepareOS UUID in term meta)
			$existing_woo_id = isset( $uuid_to_woo_id[ $prepareos_id ] ) ? $uuid_to_woo_id[ $prepareos_id ] : null;

			if ( $existing_woo_id ) {
				// Update existing term
				wp_update_term( $existing_woo_id, 'product_cat', array(
					'name'        => $name,
					'description' => $description,
					'parent'      => $woo_parent,
				) );
				$updated++;
			} else {
				// Create new term
				$result = wp_insert_term( $name, 'product_cat', array(
					'description' => $description,
					'parent'      => $woo_parent,
				) );

				if ( ! is_wp_error( $result ) ) {
					$new_term_id = $result['term_id'];
					// Store PrepareOS UUID as term meta for future syncs
					update_term_meta( $new_term_id, '_prepareos_id', $prepareos_id );
					$uuid_to_woo_id[ $prepareos_id ] = $new_term_id;
					$created++;
				}
			}
		}

		return rest_ensure_response( array(
			'ok'      => true,
			'created' => $created,
			'updated' => $updated,
		) );
	}
}
