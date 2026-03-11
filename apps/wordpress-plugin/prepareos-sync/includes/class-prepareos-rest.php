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

		register_rest_route( 'prepareos/v1', '/sync/attributes', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_sync_attributes' ),
			'permission_callback' => array( $this, 'check_api_key' ),
		) );

		register_rest_route( 'prepareos/v1', '/sync/products', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_sync_products' ),
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

	/**
	 * POST /wp-json/prepareos/v1/sync/attributes
	 *
	 * Receives product attributes (with terms) from PrepareOS and creates/updates
	 * them as WooCommerce global product attributes.
	 * Body: { "attributes": [{ "id": "uuid", "name": "...", "wooId": int|null, "terms": [{ "id": "uuid", "name": "...", "wooId": int|null }] }] }
	 */
	public function handle_sync_attributes( $request ) {
		$body       = $request->get_json_params();
		$attributes = isset( $body['attributes'] ) ? $body['attributes'] : array();

		if ( empty( $attributes ) ) {
			return new WP_Error( 'no_attributes', 'No attributes provided.', array( 'status' => 400 ) );
		}

		$created = 0;
		$updated = 0;
		$mapping = array();

		foreach ( $attributes as $attr ) {
			$name         = sanitize_text_field( $attr['name'] );
			$prepareos_id = $attr['id'];
			$woo_id       = ! empty( $attr['wooId'] ) ? (int) $attr['wooId'] : null;

			// Try to find existing attribute by wooId or by _prepareos_id in options
			$existing_attr_id = null;

			if ( $woo_id ) {
				// Verify it still exists
				$existing = wc_get_attribute( $woo_id );
				if ( $existing ) {
					$existing_attr_id = $woo_id;
				}
			}

			if ( ! $existing_attr_id ) {
				// Look up by stored PrepareOS ID
				$stored = get_option( '_prepareos_attr_' . $prepareos_id );
				if ( $stored ) {
					$existing = wc_get_attribute( (int) $stored );
					if ( $existing ) {
						$existing_attr_id = (int) $stored;
					}
				}
			}

			if ( $existing_attr_id ) {
				// Update existing attribute
				wc_update_attribute( $existing_attr_id, array(
					'name' => $name,
				) );
				$updated++;
				$attr_id = $existing_attr_id;
			} else {
				// Create new attribute
				$attr_id = wc_create_attribute( array(
					'name'         => $name,
					'slug'         => sanitize_title( $name ),
					'type'         => 'select',
					'order_by'     => 'menu_order',
					'has_archives' => false,
				) );

				if ( is_wp_error( $attr_id ) ) {
					continue;
				}

				// Store mapping
				update_option( '_prepareos_attr_' . $prepareos_id, $attr_id, false );
				$created++;
			}

			// Register the taxonomy so we can insert terms in the same request
			$taxonomy = wc_attribute_taxonomy_name_by_id( $attr_id );
			if ( $taxonomy && ! taxonomy_exists( $taxonomy ) ) {
				register_taxonomy( $taxonomy, 'product', array(
					'hierarchical' => false,
					'show_ui'      => false,
				) );
			}

			// Process terms
			$term_mapping = array();
			if ( ! empty( $attr['terms'] ) && $taxonomy ) {
				foreach ( $attr['terms'] as $term_data ) {
					$term_name     = sanitize_text_field( $term_data['name'] );
					$term_pos_id   = $term_data['id'];
					$term_woo_id   = ! empty( $term_data['wooId'] ) ? (int) $term_data['wooId'] : null;

					$existing_term_id = null;

					// Try by wooId
					if ( $term_woo_id ) {
						$term_obj = get_term( $term_woo_id, $taxonomy );
						if ( $term_obj && ! is_wp_error( $term_obj ) ) {
							$existing_term_id = $term_woo_id;
						}
					}

					// Try by stored mapping
					if ( ! $existing_term_id ) {
						$stored_term = get_option( '_prepareos_term_' . $term_pos_id );
						if ( $stored_term ) {
							$term_obj = get_term( (int) $stored_term, $taxonomy );
							if ( $term_obj && ! is_wp_error( $term_obj ) ) {
								$existing_term_id = (int) $stored_term;
							}
						}
					}

					if ( $existing_term_id ) {
						wp_update_term( $existing_term_id, $taxonomy, array(
							'name' => $term_name,
						) );
						$term_mapping[] = array( 'id' => $term_pos_id, 'wooId' => $existing_term_id );
					} else {
						$result = wp_insert_term( $term_name, $taxonomy );
						if ( ! is_wp_error( $result ) ) {
							$new_term_id = $result['term_id'];
							update_option( '_prepareos_term_' . $term_pos_id, $new_term_id, false );
							$term_mapping[] = array( 'id' => $term_pos_id, 'wooId' => $new_term_id );
						}
					}
				}
			}

			$mapping[] = array(
				'id'    => $prepareos_id,
				'wooId' => $attr_id,
				'terms' => $term_mapping,
			);
		}

		return rest_ensure_response( array(
			'ok'      => true,
			'created' => $created,
			'updated' => $updated,
			'mapping' => $mapping,
		) );
	}

	/**
	 * POST /wp-json/prepareos/v1/sync/products
	 *
	 * Receives products (with variants) from PrepareOS and creates/updates them in WooCommerce.
	 * Body: { "products": [{ "id", "name", "description", "price", "categoryWooId", "imageUrl",
	 *          "stock", "unitType", "wooId", "attributeWooId",
	 *          "variants": [{ "id", "name", "price", "stock", "capacity", "attributeTermWooId" }] }] }
	 */
	public function handle_sync_products( $request ) {
		$body     = $request->get_json_params();
		$items    = isset( $body['products'] ) ? $body['products'] : array();

		if ( empty( $items ) ) {
			return new WP_Error( 'no_products', 'No products provided.', array( 'status' => 400 ) );
		}

		$created = 0;
		$updated = 0;
		$mapping = array();

		foreach ( $items as $item ) {
			$prepareos_id    = $item['id'];
			$woo_id          = ! empty( $item['wooId'] ) ? (int) $item['wooId'] : null;
			$has_variants    = ! empty( $item['variants'] );
			$attribute_woo_id = ! empty( $item['attributeWooId'] ) ? (int) $item['attributeWooId'] : null;

			// Find existing product by wooId or by stored mapping
			$product_id = null;

			if ( $woo_id ) {
				$existing = wc_get_product( $woo_id );
				if ( $existing ) {
					$product_id = $woo_id;
				}
			}

			if ( ! $product_id ) {
				$stored = get_option( '_prepareos_product_' . $prepareos_id );
				if ( $stored ) {
					$existing = wc_get_product( (int) $stored );
					if ( $existing ) {
						$product_id = (int) $stored;
					}
				}
			}

			// Determine product type
			$product_type = $has_variants ? 'variable' : 'simple';

			if ( $product_id ) {
				$product = wc_get_product( $product_id );

				// If type changed, recreate
				if ( $product && $product->get_type() !== $product_type ) {
					wp_delete_post( $product_id, true );
					$product_id = null;
					$product    = null;
				}
			}

			if ( $product_id ) {
				// Update existing product
				$product = wc_get_product( $product_id );
				$updated++;
			} else {
				// Create new product
				if ( $has_variants ) {
					$product = new WC_Product_Variable();
				} else {
					$product = new WC_Product_Simple();
				}
				$created++;
			}

			$product->set_name( sanitize_text_field( $item['name'] ) );
			$product->set_description( sanitize_textarea_field( $item['description'] ?? '' ) );
			$product->set_status( 'publish' );

			// Price (for simple products)
			if ( ! $has_variants ) {
				$product->set_regular_price( $item['price'] );

				// Stock
				if ( isset( $item['stock'] ) && $item['stock'] !== null ) {
					$product->set_manage_stock( true );
					$product->set_stock_quantity( $item['stock'] );
				} else {
					$product->set_manage_stock( false );
				}
			}

			// Category
			if ( ! empty( $item['categoryWooId'] ) ) {
				$product->set_category_ids( array( (int) $item['categoryWooId'] ) );
			}

			// Image
			if ( ! empty( $item['imageUrl'] ) ) {
				$image_id = $this->get_or_upload_image( $item['imageUrl'], $item['name'] );
				if ( $image_id ) {
					$product->set_image_id( $image_id );
				}
			}

			// Attribute for variable products
			if ( $has_variants && $attribute_woo_id ) {
				$taxonomy = wc_attribute_taxonomy_name_by_id( $attribute_woo_id );
				if ( $taxonomy ) {
					// Collect all term IDs from variants
					$term_ids = array();
					foreach ( $item['variants'] as $v ) {
						if ( ! empty( $v['attributeTermWooId'] ) ) {
							$term_ids[] = (int) $v['attributeTermWooId'];
						}
					}

					if ( ! empty( $term_ids ) ) {
						$attribute = new WC_Product_Attribute();
						$attribute->set_id( $attribute_woo_id );
						$attribute->set_name( $taxonomy );
						$attribute->set_options( $term_ids );
						$attribute->set_visible( true );
						$attribute->set_variation( true );

						$product->set_attributes( array( $attribute ) );
					}
				}
			}

			// Save the product
			$saved_id = $product->save();

			// Store mapping
			if ( ! $product_id ) {
				update_option( '_prepareos_product_' . $prepareos_id, $saved_id, false );
			}

			// Handle variants
			if ( $has_variants && $saved_id ) {
				$this->sync_variants( $saved_id, $item['variants'], $attribute_woo_id );
			}

			$mapping[] = array(
				'id'    => $prepareos_id,
				'wooId' => $saved_id,
			);
		}

		return rest_ensure_response( array(
			'ok'      => true,
			'created' => $created,
			'updated' => $updated,
			'mapping' => $mapping,
		) );
	}

	/**
	 * Sync variants for a variable product.
	 */
	private function sync_variants( $parent_id, $variants, $attribute_woo_id ) {
		$taxonomy = $attribute_woo_id ? wc_attribute_taxonomy_name_by_id( $attribute_woo_id ) : null;

		// Get existing variations
		$existing_variations = array();
		$parent_product = wc_get_product( $parent_id );
		if ( $parent_product && $parent_product->is_type( 'variable' ) ) {
			foreach ( $parent_product->get_children() as $child_id ) {
				$prepareos_var_id = get_post_meta( $child_id, '_prepareos_variant_id', true );
				if ( $prepareos_var_id ) {
					$existing_variations[ $prepareos_var_id ] = $child_id;
				}
			}
		}

		foreach ( $variants as $v ) {
			$var_pos_id = $v['id'];
			$variation_id = isset( $existing_variations[ $var_pos_id ] ) ? $existing_variations[ $var_pos_id ] : null;

			if ( $variation_id ) {
				$variation = wc_get_product( $variation_id );
			} else {
				$variation = new WC_Product_Variation();
				$variation->set_parent_id( $parent_id );
			}

			if ( ! $variation ) {
				continue;
			}

			$variation->set_regular_price( $v['price'] );

			// Stock
			if ( isset( $v['stock'] ) && $v['stock'] !== null ) {
				$variation->set_manage_stock( true );
				$variation->set_stock_quantity( $v['stock'] );
			} else {
				$variation->set_manage_stock( false );
			}

			// Attribute term
			if ( $taxonomy && ! empty( $v['attributeTermWooId'] ) ) {
				$term = get_term( (int) $v['attributeTermWooId'], $taxonomy );
				if ( $term && ! is_wp_error( $term ) ) {
					$variation->set_attributes( array( $taxonomy => $term->slug ) );
				}
			}

			// Description with variant name
			$variation->set_description( sanitize_text_field( $v['name'] ) );

			$saved_var_id = $variation->save();

			if ( ! $variation_id && $saved_var_id ) {
				update_post_meta( $saved_var_id, '_prepareos_variant_id', $var_pos_id );
			}
		}
	}

	/**
	 * Get or upload a product image from URL.
	 * Returns attachment ID or null.
	 */
	private function get_or_upload_image( $url, $product_name ) {
		// Check if we already imported this URL
		$existing = get_posts( array(
			'post_type'  => 'attachment',
			'meta_key'   => '_prepareos_source_url',
			'meta_value' => $url,
			'fields'     => 'ids',
			'numberposts' => 1,
		) );

		if ( ! empty( $existing ) ) {
			return $existing[0];
		}

		// Download and sideload
		if ( ! function_exists( 'media_sideload_image' ) ) {
			require_once ABSPATH . 'wp-admin/includes/media.php';
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/image.php';
		}

		$tmp = download_url( $url, 15 );
		if ( is_wp_error( $tmp ) ) {
			return null;
		}

		$file_array = array(
			'name'     => sanitize_file_name( $product_name ) . '.jpg',
			'tmp_name' => $tmp,
		);

		$attachment_id = media_handle_sideload( $file_array, 0, $product_name );

		if ( is_wp_error( $attachment_id ) ) {
			@unlink( $tmp );
			return null;
		}

		// Store source URL for dedup
		update_post_meta( $attachment_id, '_prepareos_source_url', $url );

		return $attachment_id;
	}
}
